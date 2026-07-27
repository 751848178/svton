#!/bin/bash
# Usage: wb.sh <action> <args-json> [max-chars]
MAX=${3:-6000}
curl -s -m 30 -X POST http://127.0.0.1:10086/command \
  -H 'Content-Type: application/json' \
  -d "{\"action\":\"$1\",\"args\":$2,\"session\":\"devpilot-eval-infra\"}" | head -c "$MAX"
echo
