//! spine-tail — systemd journal tailer. Emits one JSON object per line.
//!
//! Modes:
//!   live  — follows the systemd journal (via journalctl -f when sd_journal is unavailable)
//!   pipe  — reads journalctl-style lines from stdin (offline/test mode)

use serde::Serialize;
use serde_json::json;
use std::io::{BufRead, BufReader, StdoutLock, Write};
use std::process::{Command, Stdio};

#[derive(Serialize)]
struct Entry {
    ts: String,
    unit: Option<String>,
    tag: Option<String>,
    priority: String,
    message: String,
}

/// journalctl -o verbose emits PRIORITY as numeric syslog levels:
/// 0=emerg 1=alert 2=crit 3=err 4=warning 5=notice 6=info 7=debug
fn classify_priority(level: Option<&str>) -> &'static str {
    match level {
        Some("0") | Some("1") | Some("2") | Some("3") => "err",
        Some("4") | Some("5") => "warn",
        _ => "info",
    }
}

/// Parse one `journalctl -o verbose`-style record (FIELD=VALUE lines, blank-line separated).
/// Returns Some(Entry) when a MESSAGE field was present.
fn parse_verbose_record(record: &str) -> Option<Entry> {
    let mut message: Option<String> = None;
    let mut unit: Option<String> = None;
    let mut tag: Option<String> = None;
    let mut priority_raw: Option<String> = None;
    let mut ts: Option<String> = None;

    for line in record.lines() {
        // journalctl -o verbose indents fields with 4 spaces
        let line = line.trim_start();
        let (field, value) = match line.split_once('=') {
            Some(pair) => pair,
            None => continue,
        };
        match field {
            "MESSAGE" => message = Some(value.to_string()),
            "_SYSTEMD_UNIT" | "UNIT" | "USER_UNIT" => {
                if unit.is_none() {
                    unit = Some(value.to_string());
                }
            }
            "SYSLOG_IDENTIFIER" => tag = Some(value.to_string()),
            "PRIORITY" => priority_raw = Some(value.to_string()),
            "_SOURCE_REALTIME_TIMESTAMP" => ts = Some(value.to_string()),
            _ => {}
        }
    }

    let message = message?;
    // journalctl timestamps are µs since epoch
    let ts = ts
        .and_then(|us| us.parse::<u64>().ok())
        .map(|us| format_iso(us / 1000))
        .unwrap_or_else(|| String::from("unknown"));

    Some(Entry {
        ts,
        unit,
        tag,
        priority: classify_priority(priority_raw.as_deref()).to_string(),
        message,
    })
}

fn format_iso(ms: u64) -> String {
    // Civil-from-days algorithm (Howard Hinnant) — no chrono dependency.
    let secs = ms / 1000;
    let millis = ms % 1000;
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let z = days as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { y + 1 } else { y };
    format!(
        "{year:04}-{month:02}-{d:02}T{h:02}:{m:02}:{s:02}.{millis:03}Z"
    )
}

fn emit(entry: &Entry, out: &mut impl Write) {
    let _ = writeln!(out, "{}", json!(entry));
}

fn run() -> i32 {
    // Close any inherited listening fds (e.g. Electron's CDP debug port).
    // Electron opens its listener without CLOEXEC, so journalctl/spine-tail
    // children inherit it and steal accepts. We never need such fds.
    unsafe {
        let max = libc::sysconf(libc::_SC_OPEN_MAX);
        if max > 0 {
            for fd in 3..max.min(65_536) {
                libc::close(fd as i32);
            }
        }
    }
    let args: Vec<String> = std::env::args().skip(1).collect();
    let mut source: Option<String> = None;
    let mut tag_filter: Option<String> = None;
    let mut all = false;
    let mut priority: Option<String> = None;
    let mut boot: Option<String> = None;
    let mut stdin_mode = false;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--all" => all = true,
            "--stdin" => stdin_mode = true,
            "--unit" | "-u" => {
                i += 1;
                source = args.get(i).cloned();
            }
            "--tag" | "-t" => {
                i += 1;
                tag_filter = args.get(i).cloned();
            }
            "--priority" | "-p" => {
                i += 1;
                priority = args.get(i).cloned();
            }
            "--boot" | "-b" => {
                if let Some(next) = args.get(i + 1) {
                    if !next.starts_with('-') {
                        boot = Some(next.clone());
                        i += 1;
                    } else {
                        boot = Some(String::from("0"));
                    }
                } else {
                    boot = Some(String::from("0"));
                }
            }
            other => {
                eprintln!("spine-tail: unknown argument '{other}'");
                return 2;
            }
        }
        i += 1;
    }

    if stdin_mode {
        // Offline mode: consume verbose records from stdin (test harness).
        let stdin = std::io::stdin();
        let reader = BufReader::new(stdin.lock());
        let stdout = std::io::stdout();
        let mut out = stdout.lock();
        let mut record = String::new();
        let mut flush = |record: &mut String, out: &mut StdoutLock<'_>| {
            if let Some(entry) = parse_verbose_record(record) {
                emit(&entry, out);
            }
            record.clear();
        };
        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };
            // Record boundary: blank line OR a journalctl header line
            // ("Fri 2026-10-09 15:28:59.059909 AEDT [s=…]"). Headers start
            // with a weekday name and carry the [s= cursor]; fields never do.
            // (our --stdin test mode emits unindented FIELD=VALUE records,
            // which must NOT be treated as boundaries)
            let first = line.chars().next();
            let is_header = matches!(
                first,
                Some('M') | Some('T') | Some('W') | Some('F') | Some('S')
            ) && line.contains(" [s=");
            if line.is_empty() || is_header {
                flush(&mut record, out.by_ref());
            } else {
                record.push_str(&line);
                record.push('\n');
            }
        }
        flush(&mut record, out.by_ref());
        return 0;
    }

    // Live mode: spawn journalctl verbose + follow.
    let mut cmd = Command::new("journalctl");
    cmd.args(["--output=verbose", "--follow", "--no-pager"]);
    if all {
        // system + user journals merged
        cmd.arg("--merge");
    }
    if let Some(u) = &source {
        cmd.arg(format!("-u{u}"));
    }
    if let Some(t) = &tag_filter {
        cmd.arg(format!("-t{t}"));
    }
    if let Some(p) = &priority {
        cmd.arg(format!("-p{p}"));
    }
    if let Some(b) = &boot {
        cmd.arg(format!("-b{b}"));
    }

    let mut child = match cmd.stdout(Stdio::piped()).stderr(Stdio::null()).spawn() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("spine-tail: failed to spawn journalctl: {e}");
            return 1;
        }
    };
    let stdout = child.stdout.take().expect("piped stdout");
    let reader = BufReader::new(stdout);
    let out_stdout = std::io::stdout();
    let mut out = out_stdout.lock();
    let mut record = String::new();
    let mut flush = |record: &mut String, out: &mut StdoutLock<'_>| {
        if let Some(entry) = parse_verbose_record(record) {
            emit(&entry, out);
        }
        record.clear();
    };
    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        let is_header = matches!(
            line.chars().next(),
            Some('M') | Some('T') | Some('W') | Some('F') | Some('S')
        ) && line.contains(" [s=");
        if line.is_empty() || is_header {
            flush(&mut record, out.by_ref());
        } else {
            record.push_str(&line);
            record.push('\n');
        }
    }
    flush(&mut record, out.by_ref());
    let _ = child.wait();
    0
}

fn main() {
    std::process::exit(run());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_verbose_record_with_unit_and_priority() {
        let rec = "_SOURCE_REALTIME_TIMESTAMP=1760000000000000\n\
                   _SYSTEMD_UNIT=spine-demo.service\n\
                   PRIORITY=6\n\
                   MESSAGE=hello from spine\n";
        let e = parse_verbose_record(rec).expect("entry");
        assert_eq!(e.message, "hello from spine");
        assert_eq!(e.unit.as_deref(), Some("spine-demo.service"));
        assert_eq!(e.priority, "info");
        assert!(e.ts.starts_with("20"));
    }

    #[test]
    fn err_priority_classified() {
        let e = parse_verbose_record("PRIORITY=3\nMESSAGE=boom\n").expect("entry");
        assert_eq!(e.priority, "err");
    }

    #[test]
    fn syslog_tag_mapped_to_tag() {
        let e = parse_verbose_record("SYSLOG_IDENTIFIER=spine-tag-demo\nMESSAGE=tagged\n")
            .expect("entry");
        assert_eq!(e.tag.as_deref(), Some("spine-tag-demo"));
        assert!(e.unit.is_none());
    }

    #[test]
    fn record_without_message_is_skipped() {
        assert!(parse_verbose_record("PRIORITY=6\n_SYSTEMD_UNIT=x\n").is_none());
    }

    #[test]
    fn iso_format_known_epoch() {
        // 0 ms epoch => 1970-01-01T00:00:00.000Z
        assert_eq!(format_iso(0), "1970-01-01T00:00:00.000Z");
        // 1_000_000_000_000 ms => 2001-09-09T01:46:40.000Z (UTC)
        assert_eq!(format_iso(1_000_000_000_000), "2001-09-09T01:46:40.000Z");
    }

    #[test]
    fn warning_classified() {
        let e = parse_verbose_record("PRIORITY=4\nMESSAGE=careful\n").expect("entry");
        assert_eq!(e.priority, "warn");
    }
}
