## 上下文

Figma Motion 把时间轴绑定到顶层 Frame，把手工关键帧绑定到节点属性，并同时提供 Auto-keyframe、
动画 Style、缓动/弹簧和随组件继承的动画。Compose UI 没有显式页面 Frame 根，但已经拥有稳定资源
引用、Capability、Component Inspector、页面 setup value 绑定、独立 Preview 与隐式 Canvas，适合以
动画资源加节点能力的方式实现相同工作流。

底部动画面板、时间轴、播放控制区与右侧关键帧 Inspector 的视觉与交互基准是 `design/alimation.png`
设计稿，实现和 Playwright 黄金图（见 tasks.md 7.4）MUST 以该稿为准，出现分歧时以本 design.md 的文字
决策为准并回填更新设计稿或在此说明偏离原因。设计稿确认的具体细节：

- 底部标签栏固定顺序为 资源、动画、命令、日志，当前活动为“动画”。
- 左侧场景图列出容器后代的可动画节点（如 Fault、Alarm），选中节点在时间轴中高亮为一条独立轨道行。
- 播放控制区从左到右为：播放/暂停、Auto-keyframe（菱形图标）、当前时间输入框、总时长输入框、
  时间单位（ms）、重新生成/刷新，以及带红点强调的“自动记录属性”开关。
- 时间轴刻度以 100ms 为主分度；节点行下方展开属性轨道（如“背景填充”），轨道上以菱形标记关键帧，
  播放头为竖直贯穿线，选中关键帧的菱形带外圈高亮，轨道末尾以对应颜色色块提示该属性的最终取值。
- 右侧关键帧 Inspector 标题格式为 `节点 / 属性`（如 `Fault / 背景填充`），并显示帧序号（如 `3/4`）、
  时间、属性名、值（含色板）与插值方式；插值为 Bezier/Spring 时下方以“曲线”“弹簧”两个 Tab 展开
  可视化编辑器，Linear 场景下曲线 Tab 显示对角直线并标注 “Linear”。

本变更服务于数据大屏的状态与告警动效。典型流程是：给 `Fault` 节点添加动画能力，绑定一份
白色到红色的动画资源，把 `Animation.play` 绑定到 setup 返回的 `playFault`，再由 Preview 根据业务
数据自动播放或恢复基础状态。

## 目标/非目标

- 目标：可复用、可校验的 Animation Asset v1；节点能力和 setup value 绑定；容器范围时间轴；
  自动属性轨道；Stage/Preview 一致的运行时插值；显式保存和资源冲突处理。
- 目标：动画结果不进入正式文档事务，不触发 Yoga 重排，并可在资源缺失或绑定失效时局部降级。
- 非目标：音视频、导出、动画状态机、多个播放器混合、布局动画、组件实例内部目标、动画变量库、
  跨 Provider 复制或 `useAutomation` 命令式 API。

## 决策

### 独立包使用双入口

新增 `@compose-ui/animation`。根入口只依赖 `core`、`assets` 与 `script-runtime`，导出资源协议、
解析/序列化、Store、确定性插值器、播放器和 FrameSnapshot。`@compose-ui/animation/react` 以 React
为 peer，可依赖 `component-registry`、`components` 与 `ui-context`，导出时间轴、Inspector、
Capability/Component definitions 和受控编辑会话。整个包不得依赖 `editor`、`stage`、`preview` 或
`materials`；这些上层包只通过公共入口组合它。

`materials` 需要注册默认 Animation Component Definition 并组合 animation 包的 Inspector（见
「内建动画能力与视觉安全通道」增量），这在 AGENTS.md 当前的架构边界中尚未授权——`materials` 的
允许依赖列表未包含 `animation`。本变更 MUST 在同一提交中把 `animation` 加入 AGENTS.md 中
`materials` 的允许依赖枚举，并同步更新依赖检查配置（架构 lint/dependency-cruiser 规则），方向仍是
单向的 `materials → animation`；`animation` 包本身继续禁止依赖 `materials`。

### Animation Asset v1 是单文件单时间线

资源使用 `.animation.json` 和 `application/vnd.compose-ui.animation+json`。顶层保存 kind、版本、
正整数 `durationMs`、目标槽位和轨道。时间、delay 均使用整数毫秒，避免持续浮点换算。

目标包含固定 `self` 与零到多个稳定命名槽位。槽位 ID 不随显示名或场景节点改名变化；消费节点的
`Animation.targets` 把槽位映射到宿主普通后代 Entity。映射不得越过组件实例边界。节点移出宿主子树
后保留原映射并报告失效，不猜测新目标。

轨道以稳定 ID、目标槽位、属性通道和 `set | offset | scale` 操作寻址。关键帧以稳定 ID、整数时间、
严格 JSON 值和 easing 保存；easing 表示从上一关键帧进入当前关键帧的区间，首帧 easing 不参与计算。
同一资源不得重复驱动同一目标槽位和属性通道。

### 节点能力每个 Entity 只拥有一个播放器

`Animation` Component 保存 version、可空资源引用、槽位映射和参数：`play`、`playback`、`delayMs`、
`speed`。默认分别为 `false`、`once`、`0`、`1`。`play` 是唯一可绑定参数；其余参数是 authored JSON。

`play=true` 在 delay 后从头开始。once 完成后保持末帧；loop 重复正向；ping-pong 重复正反。
`play=false` 取消等待和播放并恢复 Entity authored 基础值。初次挂载时 `play=true` 等价于一次上升沿。

一个节点只拥有一份 Animation Component，但资源可通过命名槽位驱动其后代。不同 Animation 若解析到
相同 Entity/属性通道，编辑器拒绝后创建的冲突；判定“后创建”以编辑会话内当次写入 Animation 引用/
目标映射的文档事务顺序为准（事务历史天然有序，不依赖 Component 自身的时间戳字段）。跨会话或外部
写入的文档没有可信的事务顺序，此时按 Entity 稳定场景遍历顺序（Hierarchy 深度优先、同级按
sibling index）确定性地保留第一条轨道并诊断其余项。

### Bindings v2 泛化 Component 字段绑定

Core 同时接受现有 `Bindings.version: 1` 与新增 version 2。v2 允许可选 `rendererProps` 和
`componentFields`，但整个 Component 至少保存一个绑定。Component 字段引用继续使用
`{ scope: 'page', exportName }`，不保存运行值。

Component Definition 可以声明稳定 value Field Contract、authored getter 和同步 validator。Registry
提供与 Renderer Props 对称的解析和 Inspector binding port。`Animation.play` Contract 只接受 boolean
value export；缺失、类型错误或 validator 失败时回退 authored `play` 并发布 diagnostic。

首次写 Component 字段绑定时把现有 v1 Bindings 规范化为 v2；加载旧文档不改写。解绑最后一项时删除
Bindings；移除能力时在同一事务中清理 `Animation` 的字段绑定。

### Runtime 只发布视觉覆盖

headless Runtime 使用可注入 clock/scheduler，输出按 Entity ID 索引的 FrameSnapshot。v1 通道为：

- 位置：相对当前 LayoutSnapshot 的视觉 translate，不写 LayoutItem。
- 旋转：相对或绝对 rotation 覆盖。
- 缩放：从 1,1 开始的视觉 scale，不新增持久化 Transform scale。
- 透明度：0..1 的 set 值。
- 背景：仅支持 solid ComposePaint，按 RGBA 插值。

Bezier 使用合法 cubic-bezier；Spring 保存 mass、stiffness、damping 并在区间末端精确归一为 1；Hold
保持上一帧值直到当前帧。透明度与颜色在插值后钳制，位置、旋转、缩放允许 Spring overshoot。

Stage/Preview 在既有 Entity 样式之上应用同一 FrameSnapshot。Stage 普通模式不执行正式播放器；动画
面板打开时受控播放头拥有最高优先级。Preview 根据页面 scope 驱动播放器。资源错误、槽位错误或冲突
只回退对应通道，文档、布局、Scene Tree 和其他动画不受影响。

### 容器时间轴聚合、单资源编辑

时间轴范围按选区确定：选中 Hierarchy Entity 时使用自身；选中叶子时使用最近 Hierarchy 祖先；顶层
叶子使用隐式 Canvas。时间轴显示范围内全部后代 Animation，每个节点一条持续区间，下方显示自动识别
的属性轨道。当前只有一个动画资源处于可编辑状态，点击其他节点轨道可切换活动资源。

容器播放头用于聚合预览，不成为 Preview 的共享时钟。预览范围取每个动画首个有效周期结束时间的
最大值；loop 只展示一个正向周期，ping-pong 展示一个往返周期。

底部动画面板使用现有 bottom Edge Group，横跨左侧、Canvas 与右侧区域；标签顺序固定为资源、动画、
命令、日志。播放区提供播放/暂停、Auto-keyframe、当前时间、总时长、ms/s 显示单位与
once/loop/ping-pong 控制。

### Auto-keyframe 拦截可动画属性命令

Auto-keyframe 是编辑会话状态，进入动画编辑时默认开启且可关闭。开启时，Editor 的 recording adapter
检查正式命令：可动画字段被转换为动画草稿操作，非动画字段继续派发文档事务。材料和 Stage 不识别
动画包，只使用注入的 dispatch/recording port。

新轨道在播放头大于 0 时自动以当前 authored/布局值创建 0ms 基础帧，并在当前时间写新帧；0ms 修改
只写一个帧。已有同时间帧直接更新。连续拖动或颜色编辑合并为一个动画会话历史项。录制关闭时全部
属性编辑保持原文档语义。界面不提供“添加属性”。

选中关键帧时右侧上下文 Inspector 编辑时间、值和进入该帧的 easing；选中帧区间时只编辑 easing；
清除时间轴选择后恢复节点 Inspector。

### 动画资源使用草稿和显式保存

Animation Store 复用 Provider 的稳定 assetKey、revision、resolve 与 subscribe。时间轴编辑只修改带
Undo/Redo 的会话草稿；保存或 Ctrl+S 才按 expected revision 写 Provider。冲突提供重新加载或显式
覆盖，Preview 继续使用最后成功保存的 revision。

创建资源时先写文件，再用一个文档事务附加引用；资源创建成功后文档事务失败时允许留下未引用文件。
Undo 不删除资源。自动创建的槽位和当前节点映射先留在草稿；资源保存成功后再提交映射事务。

## 考虑过的替代方案

- 节点内联关键帧：最接近 Figma 手工轨道，但文档膨胀，跨页面复用只能依赖 Component Asset，无法满足
  独立动画文件需求。
- 内联后提取资源：兼顾一次性动画和复用，但需要双事实来源、提取/断链和同步语义，不适合作为 v1。
- 全页共享播放时钟：适合演示编排，却与每个节点的 setup `play` 参数冲突；本次只让容器播放头承担
  编辑预览。
- 任意 JSON 路径插值：扩展快但会动画不可安全修改的字段，且无法处理 Layout、颜色和视觉变换差异；
  v1 使用封闭的视觉安全通道。

## 风险/权衡

- 动画资源与节点映射不能跨 Provider 原子提交 → 始终先保存资源，再提交文档事务；失败留下可回收的
  未引用资源而不是损坏文档。
- 共享动画资源编辑会影响多个消费节点 → Inspector 明确显示资源引用，保存使用 revision 冲突保护，
  不在后台自动覆盖。
- 动画目标可能因重设父级失效 → 保留稳定映射和诊断，要求用户显式重绑。
- Spring、requestAnimationFrame 与截图测试具有非确定性 → Runtime 注入时钟；E2E 使用受控播放头、
  禁用实时动画并在固定帧截图。
- Bindings v2 扩大公共协议 → 同时保留 v1 解析和 Renderer 行为，新增路径使用增量 validator 与回归测试。

## 迁移计划

不升级 ComposeDocument v6，也不在加载时迁移。旧 Bindings v1 原样解析；用户首次保存 Component 字段
绑定时写 v2。没有 Animation Component 的文档、未注入动画 Store/Resolver 的宿主以及独立只传文档的
Preview 保持现状。

## 待解决问题

布局动画、组件实例内部槽位、动画变量与多播放器混合均明确留待后续提案。

