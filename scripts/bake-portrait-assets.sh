#!/usr/bin/env bash
# 将 `src/assets/game` 内主菜单底图与球场纹理居中裁切为逻辑竖版像素（与 DESIGN_WIDTH×DESIGN_HEIGHT、球场框一致）。
# 适用于 AI 常输出横向固定画布（如 1536×1024）的情况。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
G="$ROOT/src/assets/game"
magick "$G/bg_main_menu.png" -resize '750x1624^' -gravity center -extent 750x1624 "$G/.tmp_bg_bake.png"
mv "$G/.tmp_bg_bake.png" "$G/bg_main_menu.png"
magick "$G/pitch_topdown.png" -resize '660x920^' -gravity center -extent 660x920 "$G/.tmp_pitch_bake.png"
mv "$G/.tmp_pitch_bake.png" "$G/pitch_topdown.png"
echo "bake-portrait-assets: bg_main_menu.png -> 750x1624, pitch_topdown.png -> 660x920"
