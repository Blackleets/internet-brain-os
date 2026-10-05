#!/bin/bash
# Supervisor: keeps the queue worker alive (restart loop). pid of this loop in /tmp/hermes-worker.pid.
export PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH
set -a; . /tmp/.hermes-worker-env; set +a
cd /tmp/efesto-live
child=0
trap 'echo "$(date -u +%FT%TZ) supervisor stopping"; [ $child -ne 0 ] && kill $child 2>/dev/null; rm -f /tmp/hermes-worker.child.pid; exit 0' TERM INT
while true; do
  node /tmp/efesto-live/queue-worker.mjs &
  child=$!; echo $child > /tmp/hermes-worker.child.pid
  wait $child; code=$?
  echo "$(date -u +%FT%TZ) queue worker exited ($code); restarting in 15s"
  sleep 15
done
