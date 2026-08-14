## 上下文

Figma Motion 把时间轴绑定到顶层 Frame，把关键帧绑定到节点属性，并提供随组件继承的动画 Style。
Compose UI 没有显式页面 Frame 根，但已经拥有稳定资源引用、Capability、页面 setup value 绑定与独立
Preview，适合用"动画资源 + 节点能力"实现同一工作流。

本变更是三个动画提案中的第二个，只做协议与运行时：

1. `add-component-field-binding`（前置）：Component 字段绑定页面 setup value。
2. **本变更**：Animation Asset v1、Animation 能力、确定性 Runtime、Preview 播放。
3. `add-animation-timeline-editor`（后续）：底部时间轴、Auto-keyframe、关键帧 Inspector、Stage 预览。

本变更没有可视化刻帧界面。验收路径是：宿主预置或用 Asset Browser 的 JSON 编辑能力写一份
`.animation.json`，在 Inspector 里绑定给节点，再由 setup 的 boolean 驱动 Preview 播放。这条纵向流程
足以证明协议与运行时正确，也让时间轴提案可以在一个已经能播的系统上开发。

## 目标/非目标

- 目标：可复用、可校验的 Animation Asset v1；节点能力与 `play` 绑定；确定性插值与播放；资源缺失或
  绑定失效时局部降级。
- 目标：动画结果是纯运行时视觉覆盖，不进入文档事务、不触发 Yoga 重排。
- 非目标：时间轴 UI、Auto-keyframe、关键帧编辑、Stage 受控播放头（均属后续提案）。
- 非目标：音视频、导出、动画状态机、布局动画、组件实例内部目标、动画变量库、跨 Provider 复制、
  `useAutomation` 式命令式 API。

## 决策

### 独立包使用双入口

新增 `@compose-ui/animation`。根入口只依赖 `core`、`assets` 与 `script-runtime`，导出资源协议、
解析/序列化、Store、插值器、播放器与 FrameSnapshot；`/react` 子入口以 React 为 peer，可依赖
`component-registry`、`components` 与 `ui-context`，导出 Animation Component Definition、Capability
与 Inspector。

**Definition 由组合层注册，不让 `materials` 依赖 `animation`。** Animation 能力的适用性是完全通用的
（任何未锁定的 Renderer / Hierarchy / Group / 组件实例宿主），没有 per-material 语义，因此它不属于
"基础物料"。让 `materials` 依赖 `animation` 只是为了搭一次注册的便车，代价是修改 AGENTS.md 的架构
边界枚举并把动画语义永久混进物料包。改由 `editor` / `app` 在组装 Registry 时注册 Animation
Definition，架构边界一行都不用动。可动画通道表同理定义在 `animation` 包内，而不是 `materials`。

### Animation Asset v1 是单文件单时间线

资源使用 `.animation.json` 与 `application/vnd.compose-ui.animation+json`。顶层保存 kind、版本、
正整数 `durationMs`、目标槽位与轨道。时间与 delay 一律使用整数毫秒，避免持续浮点换算。

目标包含固定 `self` 与零到多个稳定命名槽位。槽位 ID 不随显示名或场景节点改名变化；消费节点的
`Animation.targets` 把槽位映射到宿主普通后代 Entity。映射不得越过组件实例边界。节点移出宿主子树后
保留原映射并报告失效，不猜测新目标。

轨道以稳定 ID、目标槽位、属性通道与 `set | offset | scale` 操作寻址。关键帧以稳定 ID、整数时间、
严格 JSON 值与 easing 保存；easing 表示从上一关键帧进入当前关键帧的区间，首帧 easing 不参与计算。
同一资源不得重复驱动同一目标槽位与属性通道。

### 节点能力每个 Entity 只有一个播放器

`Animation` Component 保存 version、可空资源引用、槽位映射与参数 `play`、`playback`、`delayMs`、
`speed`，默认 `false`、`once`、`0`、`1`。`play` 是唯一可绑定参数，其余是 authored JSON。

`play=true` 在 delay 后从头开始。once 完成后保持末帧；loop 重复正向；ping-pong 重复正反。
`play=false` 取消等待与播放并恢复 authored 基础值。初次挂载时 `play=true` 等价于一次上升沿。

一个节点只有一份 Animation Component，但资源可通过命名槽位驱动其后代。不同 Animation 若解析到同一
Entity 的同一属性通道即为冲突：编辑期拒绝当次写入的后创建者（以文档事务顺序判定，事务历史天然
有序，不依赖 Component 自身时间戳）；跨会话或外部写入的文档没有可信事务顺序，按 Entity 稳定场景
遍历顺序（Hierarchy 深度优先、同级按 sibling index）保留第一条轨道并诊断其余项。

### v1 通道集合与 scale 的授权路径

v1 通道为：

- **位置**：相对当前 LayoutSnapshot 的视觉 translate，不写 LayoutItem。
- **旋转**：相对或绝对 rotation 覆盖。
- **缩放**：从 `1,1` 开始的视觉 scale，不新增持久化 Transform scale。
- **透明度**：0..1 的 set 值。
- **背景**：仅支持 solid ComposePaint，按 RGBA 插值。

其中 **scale 在 ComposeDocument 里没有 authored 对应字段**（`ComposeTransform` 只有 `rotation`）。
这意味着它不可能由"修改属性→录制"的路径产生。本变更保留 scale 通道（呼吸/脉冲是大屏告警的核心
动效），并把授权路径的责任显式交给时间轴提案：后续提案 MUST 为没有 authored 对应物的通道提供一个
窄口径的显式"添加轨道"入口。若那里决定不提供，则 scale MUST 从 v1 通道集合中移除——两者必须二选一，
不允许留下一个不可达通道。

Bezier 使用合法 cubic-bezier；Spring 保存 mass、stiffness、damping 并在区间末端精确归一为 1；Hold
保持上一帧值直到当前帧。透明度与颜色在插值后钳制，位置、旋转、缩放允许 Spring overshoot。

### Runtime 只发布视觉覆盖，且不走 React 状态

headless Runtime 使用可注入 clock/scheduler，输出按 Entity ID 索引的 FrameSnapshot。消费方在既有
Entity 样式之上应用同一份快照。

**帧提交必须走非 React 路径。** 多个播放器各自按 rAF 推进，如果每帧都经由 React state 提交，60fps
下会稳定引发 re-render 风暴。约定：帧覆盖通过订阅 + ref 直接写入目标元素样式；只有轨道集合或资源
身份发生变化才触发 React 渲染。

资源错误、槽位错误或冲突只回退对应通道，文档、布局、Scene Tree 与其他动画不受影响。

### Store 复用资源 Provider 语义

Animation Store 复用 ComposeAssetProvider 的稳定 assetKey、revision、resolve 与 subscribe，提供创建、
读取、按 expected revision 保存、订阅失效与 Abort。播放器订阅资源，保存成功后使用新 revision。

创建资源时先写文件，再用一个文档事务附加引用；资源创建成功而文档事务失败时允许留下未引用文件，
Undo 不删除资源。理由：动画资源与节点映射分属两个 Provider，无法原子提交；先资源后文档的顺序保证
失败时留下的是可回收的孤儿文件，而不是引用了不存在资源的损坏文档。

草稿、Undo/Redo 与显式保存冲突处理属于编辑会话，由时间轴提案定义；本变更的 Store 只需支持一次性
的完整候选写入。

## 考虑过的替代方案

- **节点内联关键帧**：最接近 Figma 手工轨道，但文档膨胀，跨页面复用只能依赖 Component Asset，
  无法满足独立动画文件需求。
- **内联后提取资源**：兼顾一次性动画与复用，但需要双事实来源、提取/断链与同步语义，不适合 v1。
- **全页共享播放时钟**：适合演示编排，但与每个节点独立的 setup `play` 冲突。
- **任意 JSON 路径插值**：扩展快但会动画不可安全修改的字段，且无法处理 Layout、颜色与视觉变换的
  差异；v1 使用封闭的视觉安全通道。

## 风险/权衡

- 动画资源与节点映射不能跨 Provider 原子提交 → 始终先保存资源再提交文档事务。
- 共享动画资源被多个节点消费 → Inspector 明确显示资源引用；保存使用 revision 冲突保护。
- 动画目标可能因重设父级失效 → 保留稳定映射与诊断，要求用户显式重绑。
- Spring 与 rAF 具有非确定性 → Runtime 注入时钟；测试使用受控时钟，E2E 禁用实时动画。
- 没有可视化刻帧界面时资源需手写 JSON → 这是本变更的已知边界，验收使用固定 fixture 资源；
  时间轴提案负责补上创作路径。

## 迁移计划

不升级 ComposeDocument v6，不做加载时迁移。没有 Animation Component 的文档、未注入 Animation
Store/Resolver 的宿主与只传文档的独立 Preview 保持现状。

## 待解决问题

布局动画、组件实例内部槽位、动画变量与多播放器混合均明确留待后续提案。
