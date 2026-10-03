#!/usr/bin/env bash
# 构建 qml-grab（增量），把导出器为每份夹具产出的 native/qt/out/export/<夹具>/Scene.qml 逐份截图到
# native/qt/out/qt/<夹具>.png。导出结果由 e2e/qt-reference.spec.ts 写出，先跑它。
#
# 带页面脚本的夹具（目录里有 page.setup.mjs）延迟截图，等脚本里的定时器与 fetch 落定；
# fetch 读的是场景旁边的本地文件，Qt 的 XMLHttpRequest 默认不许读本地文件，这里放开。
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

# 导出的 QML 只写字族名，夹具字体在这里注册——与预览一侧经路由加载的是同一个文件。
fonts=()
for font in "$QT_DIR"/fixtures/fonts/*.ttf; do fonts+=(--font "$font"); done

shopt -s nullglob
exported=("$QT_DIR"/out/export/*/Scene.qml)
if [[ ${#exported[@]} -eq 0 ]]; then
  echo "没有找到导出结果 $QT_DIR/out/export/*/Scene.qml，先运行 e2e/qt-reference.spec.ts" >&2
  exit 1
fi
export QML_XHR_ALLOW_FILE_READ=1

status=0
for qml in "${exported[@]}"; do
  dir="$(dirname "$qml")"
  name="$(basename "$dir")"
  delay=()
  [[ -f "$dir/page.setup.mjs" ]] && delay=(--delay-ms 800)
  if "$QT_DIR/build/tools/qml-grab/qml-grab" "$qml" "$OUT/$name.png" "${fonts[@]}" ${delay[@]+"${delay[@]}"}; then
    echo "✓ $name"
  else
    echo "✗ $name（qml-grab 退出码 $?）" >&2
    status=1
  fi
done
exit "$status"
