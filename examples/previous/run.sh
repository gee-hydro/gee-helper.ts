#!/usr/bin/env bash
cd "$(dirname "${BASH_SOURCE[0]}")/.." && exec timeout "${RUN_TIMEOUT:-180}" node_modules/.bin/tsx scripts/run-gee-script.ts "${@:-examples/test01.js}"
