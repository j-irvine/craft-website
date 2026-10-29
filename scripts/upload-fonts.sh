#!/bin/sh
# Uploads the brand's web fonts to the Worker's KV, once. Trio Grotesk is licensed, so the fonts
# never go in this public repo. Usage: scripts/upload-fonts.sh <Craft Apps checkout>/brand/fonts/Type
set -e
dir="$1"
npx wrangler@4 kv key put --binding DATA --remote font:kk-topo --path "$dir/KK-Topo/KK-Topo-Regular.woff2"
npx wrangler@4 kv key put --binding DATA --remote font:trio-grotesk-bold --path "$dir/Trio Grotesk/Web/TrioGrotesk-Bold.woff2"
