## MODIFIED Requirements

### Requirement: 嵌套 Frame 只暴露播放控制

宿主 Frame MUST NOT 对嵌套 Frame（组件实例）内部的 Entity 建立轨道或写入关键帧。
宿主对嵌套 Frame 的唯一动画能力 MUST 是 **seek**：给出一条动画 id 与一个播放头毫秒，
实例内部按该动画在该时刻采样。命令 handler MUST 在写入前拒绝任何指向嵌套 Frame 内部的
轨道命令，并返回稳定 issue。

seek 的入口 MUST 是宿主页面上那个实例 Entity 自己的 Renderer Prop，因而 MUST 可通过既有的
`Bindings.rendererProps` 机制逐实例绑定到不同的页面导出。组件文档内部的
`Animations.bindings` 在实例中 MUST NOT 生效——嵌套文档没有自己的脚本作用域。

实例内部 MUST NOT 持有播放时钟：清单条目的 `autoplay` 与 `playbackMode` 在实例中 MUST 被
忽略，不得据此自行推进播放头。需要连续播放时由宿主页面脚本驱动被绑定的播放头数值。

#### Scenario: 拒绝对实例内部打关键帧

- **WHEN** 用户下钻进组件实例内部并尝试为某个内部 Entity 建立轨道
- **THEN** 命令被拒绝并返回稳定 issue
- **AND** 宿主文档与撤销历史不发生变化

#### Scenario: 控制嵌套播放

- **WHEN** 宿主把某个组件实例的播放头设为 200 ms
- **THEN** 该实例内部按其自身动画在 200 ms 采样
- **AND** 宿主 Frame 的播放头不受影响

#### Scenario: 同一组件的两个实例各走各的播放头

- **WHEN** 页面上放两个引用同一组件的实例，各自把播放头绑到不同的页面导出，两个导出取不同值
- **THEN** 同一帧内两个实例呈现各自时刻的姿态
- **AND** 两个实例都不复制组件文档的动画清单

#### Scenario: 组件文档内的绑定在实例中不生效

- **WHEN** 组件文档的动画清单声明了 `bindings.currentTime`，该组件被实例化到页面上
- **THEN** 实例不因该声明产生任何播放头变化
- **AND** 实例的播放头只由宿主侧 Renderer Prop 决定

#### Scenario: 实例忽略自动播放

- **WHEN** 组件文档的动画标记了 `autoplay` 且播放模式为循环
- **THEN** 实例停在其播放头当前值，不自行推进
- **AND** 实例内不创建任何逐帧循环
