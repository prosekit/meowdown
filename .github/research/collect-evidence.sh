#!/bin/bash
# Collect crash reports, system logs, and machine info after the test loop.
set -u
OUT="$RUNNER_TEMP/research-out"
mkdir -p "$OUT/diagnostics/user" "$OUT/diagnostics/system"

cp -R "$HOME/Library/Logs/DiagnosticReports/." "$OUT/diagnostics/user/" 2>/dev/null || true
sudo cp -R /Library/Logs/DiagnosticReports/. "$OUT/diagnostics/system/" 2>/dev/null || true
sudo chown -R "$(id -u)" "$OUT/diagnostics" 2>/dev/null || true
ls -laR "$OUT/diagnostics" > "$OUT/diagnostics-listing.txt" 2>&1 || true

{
  sysctl hw.memsize hw.ncpu hw.model vm.swapusage
  sw_vers
  uname -a
} > "$OUT/sysinfo.txt" 2>&1

log show --last 50m --style compact \
  --predicate 'eventMessage CONTAINS[c] "memorystatus" OR eventMessage CONTAINS[c] "jetsam"' \
  > "$OUT/log-memorystatus.txt" 2>&1 || true

log show --last 50m --style compact \
  --predicate 'eventMessage CONTAINS[c] "WebContent" AND (eventMessage CONTAINS[c] "terminat" OR eventMessage CONTAINS[c] "crash" OR eventMessage CONTAINS[c] "memory" OR eventMessage CONTAINS[c] "kill")' \
  > "$OUT/log-webcontent.txt" 2>&1 || true

log show --last 50m --style compact \
  --predicate 'subsystem == "com.apple.WebKit" AND category == "Process"' \
  > "$OUT/log-webkit-process.txt" 2>&1 || true
