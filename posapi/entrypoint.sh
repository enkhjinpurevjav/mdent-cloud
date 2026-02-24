#!/usr/bin/env bash
set -e

# Try common service names (we’ll refine after first run)
service posapi start 2>/dev/null || true
service PosAPI start 2>/dev/null || true

# Keep container alive for now so we can inspect logs and running processes
tail -f /dev/null
