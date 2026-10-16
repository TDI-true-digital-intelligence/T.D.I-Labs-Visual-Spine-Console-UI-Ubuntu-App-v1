const path = require('path');
const { execFile } = require('child_process');
const proc = execFile('./dist/linux-unpacked/spine-console', ['.'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, ELECTRON_NO_SANDBOX: '1', ELECTRON_DISABLE_SANDBOX: '1' } }, () => {});
let out = '';
proc.stdout && proc.stdout.on('data', d => out += d);
proc.stderr && proc.stderr.on('data', d => out += d);
setTimeout(() => {
  const m = out.match(/engine: .*/);
  console.log(m ? 'PACKAGED-BOOT-PASS: ' + m[0] : 'PACKAGED-OUTPUT: ' + out.slice(0, 200).replace(/\n/g, ' | '));
  proc.kill('SIGTERM');
}, 8000);
