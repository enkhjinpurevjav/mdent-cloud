#!/usr/bin/env bash
set -e

# Try common service names (we will refine after first run)
service posapi start 2>/dev/null || true
service PosAPI start 2>/dev/null || true

# Keep alive so we can inspect and adjust if needed
tail -f /var/log/* 2>/dev/null || tail -f /dev/null
