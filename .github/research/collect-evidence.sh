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

# Echo the decisive evidence into the step log so a failed artifact upload
# cannot lose it.
echo '===== sysinfo ====='
cat "$OUT/sysinfo.txt"
echo '===== memorystatus events (kills and exceeded limits) ====='
grep -iE 'kill|exceeded mem limit|fatal' "$OUT/log-memorystatus.txt" | grep -v runningboard | tail -40 || true
echo '===== WebKit process terminations ====='
grep -iE 'terminat|crash|exit' "$OUT/log-webkit-process.txt" | tail -40 || true
echo '===== new diagnostic reports ====='
ls -la "$OUT/diagnostics/user" "$OUT/diagnostics/system" 2>/dev/null || true
for ips in "$OUT"/diagnostics/*/*.ips; do
  [ -f "$ips" ] || continue
  echo "----- $ips (header + termination) -----"
  head -c 2000 "$ips"
  echo
  grep -oE '"terminationReason"[^,]*|"exception"[^}]*}|"largestProcess"[^,]*' "$ips" | head -10 || true
done
echo '===== WebContent peak RSS from sampler ====='
grep 'WebKit.WebContent' "$OUT/memory-samples.log" | awk '{if ($2+0 > m) m=$2+0} END {printf "peak WebContent RSS: %.2f GB\n", m/1024/1024}' || true
