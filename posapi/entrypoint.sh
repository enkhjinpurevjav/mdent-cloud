#!/usr/bin/env bash
set -euo pipefail

# Run the service directly (recommended in containers)
if [ -x /opt/posapi/PosService ]; then
  exec /opt/posapi/PosService
fi

echo "PosService not found at /opt/posapi/PosService"
ls -la /opt || true
ls -la /opt/posapi || true
exec tail -f /dev/null
