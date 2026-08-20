## MODIFIED Requirements

### Requirement: 嵌套 Frame 只暴露播放控制

宿主 Frame MUST NOT 对嵌套 Frame（组件实例）内部的 Entity 建立轨道或写入关键帧。
宿主对嵌套 Frame 的唯一动画能力 MUST 是播放控制：play、pause、seek 与播放模式。命令 handler
MUST 在写入前拒绝任何指向嵌套 Frame 内部的轨道命令，并返回稳定 issue。

#### Scenario: 拒绝对实例内部打关键帧

- **WHEN** 用户下钻进组件实例内部并尝试为某个内部 Entity 建立轨道
- **THEN** 命令被拒绝并返回稳定 issue
- **AND** 宿主文档与撤销历史不发生变化

#### Scenario: 控制嵌套播放

- **WHEN** 宿主对某个组件实例发出 seek 到 200 ms
- **THEN** 该实例内部按其自身动画在 200 ms 采样
- **AND** 宿主 Frame 的播放头不受影响
