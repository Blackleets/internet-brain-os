#!/bin/bash
export PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH
cd /workspace/ibos-forge-live
if [ -f /tmp/forge-kernel.pid ]; then kill $(cat /tmp/forge-kernel.pid) 2>/dev/null; sleep 1; fi
HEPHAESTUS_DATA_DIR=/tmp/forge-kernel-data HEPHAESTUS_PORT=4310 HEPHAESTUS_API_TOKEN=$(cat /tmp/forge-kernel-token) HEPHAESTUS_HERMES_READY=1 HEPHAESTUS_HERMES_READ_ONLY_READY=1 HEPHAESTUS_OBSIDIAN_DIR=/tmp/forge-kernel-data/obsidian nohup node apps/local-kernel/server.mjs > /tmp/forge-kernel.log 2>&1 &
echo $! > /tmp/forge-kernel.pid
