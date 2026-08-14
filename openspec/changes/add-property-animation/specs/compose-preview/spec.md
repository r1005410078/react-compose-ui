## ADDED Requirements

### Requirement: Preview 声明式动画播放

ComposePreview MUST 能接受 Animation Runtime/Store 配置，并为文档中每个合法 Animation Component
创建独立播放器。播放器 MUST 使用同一页面 Script Scope 解析 Component Field `play`，应用与 Stage
受控预览相同的 FrameSnapshot 视觉语义，并在卸载、资源变化或页面切换时释放 scheduler、订阅和迟到
异步结果。只传 ComposeDocument/Registry 的既有 Preview MUST 保持静态 authored 渲染。

#### Scenario: setup 阈值播放告警动画
- **WHEN** playFault Computed 从 false 变为 true 且 Fault 节点绑定 300ms once 颜色动画
- **THEN** Preview 从 authored 白色播放到红色并在 true 期间保持末帧
- **AND** playFault 恢复 false 后节点立即恢复 authored 白色

#### Scenario: 多节点独立播放
- **WHEN** 同一容器内 Fault 与 Alarm 分别绑定独立 play value
- **THEN** 两个播放器按各自 delay、speed 与 playback 运行
- **AND** 容器时间轴的编辑播放头不成为 Preview 共享时钟

#### Scenario: 独立文档 Preview 保持兼容
- **WHEN** 宿主没有提供 Animation Store/Resolver 或页面 Script Scope
- **THEN** Preview 使用 authored Entity 视觉正常渲染
- **AND** 不搜索动画文件、不创建隐式 setup scope 或抛出阻断错误
