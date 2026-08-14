# 变更：新增可复用动画资源与播放运行时

## Why

编辑器只能渲染静态 Entity 属性。数据大屏最常见的告警/状态动效（白→红闪烁、位移提示、呼吸缩放）
只能在宿主代码里手写，无法作为可复用资产纳入可视化编排。

本变更提供动画的**协议与运行时**：可复用的动画资源文件、可附加到节点的 Animation 能力，以及在
Preview 中由页面 setup 状态声明式驱动的播放器。可视化时间轴与自动刻帧由后续的
`add-animation-timeline-editor` 提供；本变更的动画资源通过 Asset Browser 的既有 JSON 编辑能力或
宿主预置文件产生，已足以端到端验证运行时。

## What Changes

- 新增独立 `@compose-ui/animation` 包，headless 根入口承载资源协议、解析/序列化、Store、确定性
  插值器、播放器与 FrameSnapshot；`@compose-ui/animation/react` 承载 Animation Component Definition、
  Capability 与 Inspector。
- 新增 `.animation.json` / `application/vnd.compose-ui.animation+json` 的 Animation Asset v1：单文件
  单时间线，以固定 `self` 与稳定命名槽位寻址目标，不保存页面专属 Entity ID。
- 新增可附加到 Entity 的 `Animation` 能力：每个 Entity 至多一个，保存可空资源引用、槽位映射与
  authored `play`、`playback`、`delayMs`、`speed`；`play` 是唯一可绑定字段（依赖
  `add-component-field-binding` 的 boolean value Contract）。
- 新增确定性 Runtime：注入 clock/scheduler，输出按 Entity ID 索引的 FrameSnapshot，支持 Linear、
  cubic-bezier、Spring 与 Hold，覆盖位置偏移、旋转、缩放、透明度与纯色背景五个视觉安全通道。
- Preview 为文档中每个合法 Animation 创建独立播放器，按页面 Script Scope 解析 `play`；资源缺失、
  槽位失效或绑定错误只让对应动画回退 authored 视觉。

## Impact

- 受影响的规范：`animation`（新增）、`compose-preview`
- 受影响的代码：新增 `packages/animation`；修改 `packages/preview` 的运行时组合、发布与架构检查配置
- 依赖：`add-component-field-binding`（`Animation.play` 需要 Component Field Contract）
- 兼容性：ComposeDocument 仍为 v6。没有 Animation Component 的文档、未注入 Animation Store/Resolver
  的宿主，以及只传文档的独立 Preview 全部保持现有静态渲染行为。
- 架构边界：`animation` 根入口只依赖 `core`、`assets`、`script-runtime`；`/react` 子入口以 React 为
  peer，可依赖 `component-registry`、`components`、`ui-context`。整个包 MUST NOT 依赖 `materials`、
  `stage`、`preview` 或 `editor`；Animation Definition 由组合层（`editor` / `app`）注册，
  **不修改 AGENTS.md 的架构边界**。

## User Stories

### US-01：把可复用动画绑定到节点

作为实施工程师，我希望给节点添加"动画"能力并绑定一份动画文件，配置 loop、delay 与 speed，
从而复用同一份动效而不复制关键帧数据。

验收要点：

- 一个文档事务保存资源引用、槽位映射与播放参数；关键帧内容不复制进 ComposeDocument。
- 动画文件通过固定 `self` 与稳定命名槽位描述目标，消费节点负责把槽位映射到自身普通后代。
- 节点重命名不破坏槽位映射；节点移出宿主子树时保留原映射并显示诊断。
- 组件实例内部节点不作为 v1 槽位目标。

### US-02：用页面 setup 状态控制播放

作为实施工程师，我希望把 `Animation.play` 绑定到 setup 返回的 boolean，从而用业务数据声明式控制
动画，而不需要按文件路径取得命令式播放器。

例如页面 setup 可以返回：

```ts
const playFault = computed(() => xx.value > 123)
const playAlarm = computed(() => xx.value > 123)

return { playFault, playAlarm }
```

验收要点：

- `false → true` 按节点配置的 delay、speed 与 playback 从头播放；初次挂载 `play=true` 等价于一次上升沿。
- once 完成后在 `play=true` 期间保持末帧；`play=false` 立即恢复 authored 基础视觉。
- export 缺失、类型不是 boolean 或校验失败时回退 authored `play` 并显示非阻断诊断。
- 绑定只保存 `{ scope: 'page', exportName }`，不保存变量当前值。

### US-03：在 Preview 中可靠运行并局部降级

作为页面使用者，我希望不同告警节点按各自业务状态独立播放；即使某个动画资源损坏，页面其他内容
和动画仍然正常工作。

验收要点：

- `Fault` 与 `Alarm` 分别根据自己的 play value、delay、speed 与 playback 独立运行。
- 资源缺失、槽位失效或属性冲突只让对应动画恢复基础视觉并发布诊断。
- 页面切换或 Preview 卸载时释放时钟、资源订阅与迟到异步结果。
- 宿主未配置 Animation Store/Resolver 时，现有静态 Preview 行为保持兼容。
