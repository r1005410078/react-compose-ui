## ADDED Requirements

### Requirement: 资源 Canvas 拖拽意图

Asset Browser MUST 从文件树和目录网格发出普通数据的 start/move/end/cancel Canvas 拖拽事件，
且 MUST NOT 依赖 Stage、Core 或 ComposeDocument。

#### Scenario: 拖动单项或多项图片

- **WHEN** 用户拖动 SVG 或受支持位图，且当前多选包含其他兼容图片
- **THEN** start 事件按选择顺序包含兼容且可引用的文件
- **AND** 脚本、目录与不支持文件被排除

#### Scenario: 资源内部移动不创建节点

- **WHEN** 同一拖拽落到 Asset Browser 内的合法目录
- **THEN** Provider move 正常执行
- **AND** Canvas 生命周期以 cancel 结束
