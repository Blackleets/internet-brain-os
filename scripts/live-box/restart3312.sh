#!/bin/bash
export PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH
cd /workspace/forge-v2-build && pnpm dashboard:build > /tmp/forge-v2-build.log 2>&1 < /dev/null || { echo BUILD_FAIL; tail -30 /tmp/forge-v2-build.log; exit 1; }
PID=$(ss -ltnp | awk '/127.0.0.1:3312/' | grep -o 'pid=[0-9]*' | cut -d= -f2)
[ -n "$PID" ] && kill $PID && sleep 1
cd apps/dashboard && setsid nohup pnpm exec next start --hostname 127.0.0.1 --port 3312 > /tmp/forge-v2-3312.log 2>&1 < /dev/null &
for i in $(seq 1 20); do sleep 1; curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3312/ 2>/dev/null | grep -q 200 && { echo UP; exit 0; }; done; echo NOT_UP
