#!/usr/bin/env bash
# 按 native/qt/qt-version.json 安装 Qt 到 native/qt/.qt/，已装同一版本即跳过。
#
# 版本号只写在 qt-version.json 一处：本机与 CI 都走这个脚本，两处各写一份的症状是「本机过、CI 红」。
# 用 aqtinstall 而不是官方安装器：后者要求登录账号，无法脚本化。
#
# 用法：
#   native/qt/scripts/install-qt.sh                安装（或跳过）并在最后一行打印 Qt 前缀目录
#   native/qt/scripts/install-qt.sh --print-prefix 只打印已安装的前缀目录，未安装时以非零退出
set -euo pipefail

QT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="$QT_DIR/qt-version.json"
INSTALL_ROOT="$QT_DIR/.qt"

read_field() {
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); v=d
for k in sys.argv[2].split("."): v=v[k]
print(" ".join(v) if isinstance(v, list) else v)' "$VERSION_FILE" "$1"
}

case "$(uname -s)" in
  Darwin) HOST=mac ;;
  Linux) HOST=linux ;;
  *) echo "不支持的主机系统：$(uname -s)" >&2; exit 1 ;;
esac

QT_VERSION="$(read_field version)"
AQT_VERSION="$(read_field aqtinstall)"
QT_ARCH="$(read_field "arch.$HOST")"
QT_MODULES="$(read_field modules)"

# aqtinstall 落盘的目录名与 arch 名不一致（clang_64 → macos、linux_gcc_64 → gcc_64），
# 因此按「装好之后哪个目录里有 qmake」来找前缀，而不是在这里再维护一张映射表。
find_prefix() {
  local qmake
  qmake="$(find "$INSTALL_ROOT/$QT_VERSION" -maxdepth 3 -path '*/bin/qmake' 2>/dev/null | head -n 1)"
  [[ -n "$qmake" ]] && dirname "$(dirname "$qmake")"
}

if [[ "${1:-}" == "--print-prefix" ]]; then
  prefix="$(find_prefix || true)"
  if [[ -z "$prefix" ]]; then
    echo "Qt $QT_VERSION 尚未安装，先运行 native/qt/scripts/install-qt.sh" >&2
    exit 1
  fi
  echo "$prefix"
  exit 0
fi

# 已装模块清单与声明一致才算命中；只看版本会让新增模块（如 qtwebsockets）永远装不上。
STAMP="$INSTALL_ROOT/$QT_VERSION/.installed-modules"
prefix="$(find_prefix || true)"
if [[ -n "$prefix" && -f "$STAMP" && "$(cat "$STAMP")" == "$QT_MODULES" ]]; then
  echo "Qt $QT_VERSION 已安装，跳过下载。" >&2
  echo "$prefix"
  exit 0
fi

# 有 uv 就用 uvx（自带隔离环境与索引配置，不受本机 pip 镜像影响）；没有再退回 venv + pip，
# 此时可用 PIP_INDEX_URL 覆盖镜像。
run_aqt() {
  if command -v uvx >/dev/null 2>&1; then
    uvx --from "aqtinstall==$AQT_VERSION" aqt "$@"
    return
  fi
  local venv="$INSTALL_ROOT/.venv"
  if ! "$venv/bin/python" -m pip show aqtinstall 2>/dev/null | grep -q "^Version: $AQT_VERSION$"; then
    python3 -m venv "$venv"
    "$venv/bin/python" -m pip install --quiet "aqtinstall==$AQT_VERSION"
  fi
  "$venv/bin/aqt" "$@"
}

args=(install-qt "$HOST" desktop "$QT_VERSION" "$QT_ARCH" --outputdir "$INSTALL_ROOT")
if [[ -n "$QT_MODULES" ]]; then
  # shellcheck disable=SC2206 # 模块名不含空白，按空格拆分正是本意
  args+=(--modules $QT_MODULES)
fi
run_aqt "${args[@]}" >&2

prefix="$(find_prefix)"

# WORKAROUND: Qt 6.8.3 的 FindWrapOpenGL.cmake 在 macOS 上链接 AGL framework，而新版 macOS SDK
# 已经删掉了它，症状是链接期 `framework 'AGL' not found`。「找到才链接」不够：系统目录里的
# AGL 运行时还在，find_library 找得到，SDK 里却没有可链接的桩。Qt 6 本身不使用 AGL（上游
# 在后续版本删掉了这段），因此这里整段删除。升级到不再引用 AGL 的 Qt 版本后删掉这一段。
if [[ "$HOST" == mac ]]; then
  find_wrap_opengl="$prefix/lib/cmake/Qt6/FindWrapOpenGL.cmake"
  perl -0pi -e 's/\n\s*find_library\(WrapOpenGL_AGL NAMES AGL\).*?target_link_libraries\(WrapOpenGL::WrapOpenGL INTERFACE \$\{__opengl_fw_path\}\)/\n        target_link_libraries(WrapOpenGL::WrapOpenGL INTERFACE \${__opengl_fw_path})/s; s/\n\s*(if\(__opengl_agl_fw_path\)\n\s*)?target_link_libraries\(WrapOpenGL::WrapOpenGL INTERFACE \$\{__opengl_agl_fw_path\}\)(\n\s*endif\(\))?//' "$find_wrap_opengl"
fi

printf '%s' "$QT_MODULES" > "$STAMP"
echo "$prefix"
