## ADDED Requirements

### Requirement: Preview 声明式动画播放

ComposePreview MUST 能接受 Animation Runtime/Store 配置，并为文档中每个合法 Animation Component
创建独立播放器。播放器 MUST 使用同一页面 Script Scope 解析 Component Field `play`，按 FrameSnapshot
视觉语义应用覆盖，并在卸载、资源变化或页面切换时释放 scheduler、订阅和迟到异步结果。只传
ComposeDocument/Registry 的既有 Preview MUST 保持静态 authored 渲染。

#### Scenario: setup 阈值播放告警动画

- **WHEN** playFault Computed 从 false 变为 true 且 Fault 节点绑定 300ms once 颜色动画
- **THEN** Preview 从 authored 白色播放到红色并在 true 期间保持末帧
- **AND** playFault 恢复 false 后节点立即恢复 authored 白色

#### Scenario: 多节点独立播放

- **WHEN** 同一容器内 Fault 与 Alarm 分别绑定独立 play value
- **THEN** 两个播放器按各自 delay、speed 与 playback 运行，互不共享时钟
- **AND** 其中一个动画的资源错误不影响另一个继续播放

#### Scenario: 卸载释放播放资源

- **WHEN** 用户在动画播放中切换活动页面或卸载 Preview
- **THEN** 全部 scheduler、资源订阅与页面 scope 订阅被释放
- **AND** 迟到的异步解析结果不再写入任何已卸载目标

#### Scenario: 独立文档 Preview 保持兼容

- **WHEN** 宿主没有提供 Animation Store/Resolver 或页面 Script Scope
- **THEN** Preview 使用 authored Entity 视觉正常渲染
- **AND** 不搜索动画文件、不创建隐式 setup scope 或抛出阻断错误
