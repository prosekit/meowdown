#!/bin/bash
# Sample WebKit and node process memory every second while tests run.
set -u

while true; do
  now=$(date +%s)
  echo "--- $now"
  ps -axo pid,rss,command | grep -E 'ms-playwright|node' | grep -vE 'grep|sample-memory' | cut -c1-200
  echo "swap: $(sysctl -n vm.swapusage)"
  if [ $((now % 10)) -eq 0 ]; then
    wc_pid=$(ps -axo pid,command | grep -E 'ms-playwright.*WebContent' | grep -v grep | awk '{print $1}' | head -1)
    if [ -n "${wc_pid:-}" ]; then
      echo "footprint of WebContent $wc_pid:"
      footprint "$wc_pid" 2>&1 | head -4
    fi
  fi
  sleep 1
done
