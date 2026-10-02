# native/qt 的 CMake 入口。它不在 Bun workspace 与 Turbo 里：JS 侧只通过文件（.qml 与 PNG）
# 与这里交换，未安装 Qt 的机器上 JS 验证照常通过。
cmake_minimum_required(VERSION 3.21)
project(compose_qt LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 6.8 REQUIRED COMPONENTS Gui Qml Quick)
qt_standard_project_setup()

add_subdirectory(tools/qml-grab)
