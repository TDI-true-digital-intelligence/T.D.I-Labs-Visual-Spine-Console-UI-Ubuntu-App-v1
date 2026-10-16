#!/bin/bash
# Hermes file log shipper: tails Hermes log files → systemd journal
# Runs as systemd user service, outputs tagged lines via echo

HERMES_DIR="${HOME}/.hermes"
LOG_DIR="${HERMES_DIR}/logs"
LOGS=(
    "agent.log:spine/hermes/agent"
    "gui.log:spine/hermes/gui"
    "errors.log:spine/hermes/errors"
    "gateway.log:spine/hermes/gateway"
    "gateway-exit-diag.log:spine/hermes/gateway-exit"
    "work-state-ledger.log:spine/hermes/work-state"
    "desktop.log:spine/hermes/desktop"
    "echo-logs-auto.log:spine/hermes/echo-logs"
    "starnet-sidecar.log:spine/hermes/starnet"
    "sol-eth-bot.log:spine/hermes/sol-eth"
    "cli-storm-guard.log:spine/hermes/cli-storm"
    "vault_probe.log:spine/hermes/vault"
)

# Ensure log dir exists
mkdir -p "${LOG_DIR}"

# Create missing files so tail doesn't complain
for pair in "${LOGS[@]}"; do
    file="${LOG_DIR}/${pair%%:*}"
    touch "${file}"
done

# Build dynamic tags for multitail-like output
# Use a wrapper that prepends tag to each line
exec 3>&1
exec 4>&2

# Build command: tail all files, each line gets its tag
# We'll use a while read loop per file to prepend tag
pids=()

for pair in "${LOGS[@]}"; do
    file="${LOG_DIR}/${pair%%:*}"
    tag="${pair##*:}"
    tail -n0 -F "${file}" 2>/dev/null | \
    while IFS= read -r line; do
        # ship to journal with our tag
        systemd-cat -t "${tag}" echo "${line}"
    done &
    pids+=($!)
done

# Wait for all (will run forever)
wait "${pids[@]}"
