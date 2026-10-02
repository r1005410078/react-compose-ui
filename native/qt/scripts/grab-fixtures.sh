#!/usr/bin/env bash
# 构建 qml-grab（增量），把 native/qt/fixtures/*/expected.qml 逐份截图到 native/qt/out/qt/。
#
# 渲染平台：未设置 QT_QPA_PLATFORM 时用 offscreen，方便本机直接跑。CI 的验收环境在 workflow 里
# 固定为 xvfb + xcb + Mesa llvmpipe（见 .github/workflows/ci.yml 的 qt job），这里不替调用方决定。
set -euo pipefail

QT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFIX="$("$QT_DIR/scripts/install-qt.sh" --print-prefix)"

cmake -S "$QT_DIR" -B "$QT_DIR/build" -DCMAKE_PREFIX_PATH="$PREFIX" -DCMAKE_BUILD_TYPE=Release >/dev/null
cmake --build "$QT_DIR/build" --parallel >/dev/null

export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"
OUT="$QT_DIR/out/qt"
mkdir -p "$OUT"

status=0
for qml in "$QT_DIR"/fixtures/*/expected.qml; do
  name="$(basename "$(dirname "$qml")")"
  if "$QT_DIR/build/tools/qml-grab/qml-grab" "$qml" "$OUT/$name.png"; then
    echo "✓ $name"
  else
    echo "✗ $name（qml-grab 退出码 $?）" >&2
    status=1
  fi
done
exit "$status"
