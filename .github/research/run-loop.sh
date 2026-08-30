#!/bin/bash
# Run the full test suite on WebKit repeatedly until one run fails.
set -u
OUT="$RUNNER_TEMP/research-out"
mkdir -p "$OUT"
iterations="${RESEARCH_ITERATIONS:-4}"

for i in $(seq 1 "$iterations"); do
  echo "=== iteration $i start $(date -u '+%FT%TZ') ==="
  MEOWDOWN_TEST_BROWSER=webkit NO_COLOR=1 DEBUG='vitest:browser:pool,pw:browser' \
    VITE_FUZZ_NUM_RUNS="${RESEARCH_FUZZ_NUM_RUNS:-}" \
    pnpm run test 2>&1 | tee "$OUT/vitest-$i.log"
  status=${PIPESTATUS[0]}
  echo "=== iteration $i exit $status $(date -u '+%FT%TZ') ==="
  if [ "$status" -ne 0 ]; then
    echo "$i" > "$OUT/failed-iteration.txt"
    exit 1
  fi
done
