qt_add_executable(qml-grab main.cpp)
target_link_libraries(qml-grab PRIVATE Qt6::Gui Qt6::Qml Qt6::Quick)
# 命令行工具，不打成 macOS 应用包：调用方按路径直接执行它。
set_target_properties(qml-grab PROPERTIES MACOSX_BUNDLE OFF)
