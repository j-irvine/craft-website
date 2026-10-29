#!/bin/sh
# Uploads the brand fonts to the Worker's KV by hand. The deploy workflow does this on every deploy
# (KK Topo from fonts/, Trio Grotesk from the TRIO_GROTESK_WOFF2_BASE64 secret, as it's licensed).
# Usage: scripts/upload-fonts.sh <path to TrioGrotesk-Bold.woff2>
set -e
npx wrangler@4 kv key put --binding DATA --remote font:kk-topo --path fonts/kk-topo.woff2
npx wrangler@4 kv key put --binding DATA --remote font:trio-grotesk-bold --path "$1"
