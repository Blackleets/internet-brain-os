#!/bin/bash
# Pause the Hermes queue worker for the duration of a command; always resume (trap), even on failure/kill.
touch /tmp/hermes-worker.pause
trap 'rm -f /tmp/hermes-worker.pause' EXIT INT TERM HUP
"$@"
