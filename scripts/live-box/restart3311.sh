#!/bin/bash
# Rebuild + restart the LIVE dashboard (3311) from /workspace/ibos-forge-live (live/forge-telemetry).
export PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH
cd /workspace/ibos-forge-live && pnpm -s dashboard:build > /tmp/live-build.log 2>&1 < /dev/null || { echo BUILD_FAIL; tail -30 /tmp/live-build.log; git checkout -- apps/dashboard/next-env.d.ts 2>/dev/null; exit 1; }
git checkout -- apps/dashboard/next-env.d.ts 2>/dev/null
PID=$(ss -ltnp | awk '/127.0.0.1:3311/' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
[ -n "$PID" ] && kill "$PID" && sleep 2
cd apps/dashboard && setsid nohup pnpm exec next start --hostname 127.0.0.1 --port 3311 > /tmp/forge-dashboard.log 2>&1 < /dev/null &
echo $! > /tmp/forge-dashboard.pid
for i in $(seq 1 25); do sleep 1; curl -sf -o /dev/null http://127.0.0.1:3311/ && { echo UP; exit 0; }; done; echo NOT_UP
