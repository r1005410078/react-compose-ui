# 变更：新增可复用属性动画系统

## Why

当前编辑器只能保存和渲染静态 Entity 属性，无法在画布中刻制关键帧、复用动画资源，或由页面
setup 的响应式状态声明式控制动画播放。实施工程师因此仍需在宿主代码中手写告警、状态切换和
循环动效，无法把这类工作纳入可视化编排流程。

底部动画面板、时间轴与关键帧 Inspector 的界面以 `design/alimation.png` 设计稿为视觉与交互基准，
细节见 design.md「上下文」小节；实现和验收 MUST 对照该设计稿还原。

## What Changes

- 新增独立 `@compose-ui/animation` 包，以 headless 根入口和 React 子入口分别承载动画资源协议、
  插值/播放 Runtime、资源 Store、时间轴、关键帧 Inspector 与动画编辑会话。
- 新增 `.animation.json` / `application/vnd.compose-ui.animation+json` 的 Animation Asset v1；单个
  文件表达一条可复用时间线，以 `self` 和命名后代槽位寻址目标，不保存页面专属 Entity ID。
- 新增可附加到 Entity 的 `Animation` 能力，每个节点 v1 只绑定一个动画资源，并保存目标映射、
  `playback`、`delayMs`、`speed` 与可绑定的 `play` 参数。
- 扩展 `Bindings` 为兼容 v1/v2 的协议，并让 Component Definition 可以声明可绑定字段 Contract；
  `Animation.play` 可单向绑定页面 setup 返回的 boolean value。
- 新增容器范围、全宽底部动画时间轴：聚合后代动画，默认开启 Auto-keyframe，自动识别属性变化并
  建立轨道和关键帧，不提供手动“添加属性”。
- Stage 在动画编辑时使用播放头快照预览；Preview 使用独立播放器执行 setup 驱动的 once、loop 与
  ping-pong 动画。动画结果是纯运行时覆盖，不修改 ComposeDocument、LayoutSnapshot 或历史。
- v1 支持位置偏移、旋转、缩放、透明度与纯色背景；支持 Linear、Bezier、Spring 和 Hold，不动画
  Yoga 尺寸、Flow/Hug、间距或组件实例内部节点。

## Impact

- 受影响的规范：`animation`（新增）、`compose-document`、`component-registry`、
  `editor-workspace-layout`、`basic-materials`、`stage`、`compose-preview`
- 受影响的代码：新增 `packages/animation`；修改 core Bindings 协议、Registry Component Contract、
  Materials 默认能力、Editor Dock/Inspector、Stage/Preview Runtime 组合、发布与架构检查配置；
  在 AGENTS.md 的 `materials` 允许依赖枚举中新增 `animation`（单向 `materials → animation`）
- 兼容性：ComposeDocument 仍为 v6；旧 `Bindings.version: 1` 文档继续读取。只有首次保存 Component
  字段绑定时写入 `Bindings.version: 2`，不进行加载时迁移。
- 资源副作用：新建动画文件成功后才把引用写入文档；Undo 不删除已创建的资源文件。

## User Stories

### US-01：创建并刻制节点动画

作为实施工程师，我希望给选中的节点添加“动画”能力、创建或绑定动画文件，并直接在画布上修改属性，
从而由系统自动识别属性轨道和关键帧，而不需要手动添加动画属性。

验收要点：

- 打开底部“动画”标签后，时间轴横跨整个编辑器底部。
- Auto-keyframe 默认开启；在 0ms 保持白色、移动到 300ms 后改成红色，会自动得到颜色轨道及首尾关键帧。
- 修改关键帧只更新动画草稿，不修改节点 authored 属性，也不写入页面文档历史。
- 关闭 Auto-keyframe 后，属性编辑恢复原有 ComposeDocument 命令语义。

### US-02：查看和编辑多关键帧时间线

作为实施工程师，我希望时间轴明确展示节点、属性轨道、播放头和全部关键帧，从而可以精确检查和调整
四帧或更多帧的动画，而不是只看到一段无法解释的持续时间。

验收要点：

- 0、100、200、300ms 的四个关键帧显示为四个独立菱形，并能被逐个选择、移动和删除。
- 选择第三帧时，右侧 Inspector 显示 `3/4`、200ms、当前属性值以及进入该帧的 easing。
- 选择两帧之间的区间时，右侧 Inspector 切换为 Curve、Spring 或 Hold 编辑器。
- 清除时间轴选择后，右侧 Inspector 恢复显示当前节点及其 Animation 能力。

### US-03：聚合查看容器中的多个动画

作为实施工程师，我希望选择一个容器后，在同一时间轴中查看 `Fault`、`Alarm` 等后代节点的动画，
从而协调一组告警动效，同时仍能清楚区分每个节点使用的动画资源。

验收要点：

- 时间轴按节点显示持续区间，并在节点下展开系统自动识别的属性轨道。
- 点击某个节点或轨道只切换当前活动动画资源，不改变 Scene Tree 层级。
- 容器播放头用于聚合编辑预览；Preview 中每个节点仍拥有独立播放时钟。

### US-04：复用动画文件并保持稳定绑定

作为实施工程师，我希望把同一份动画文件绑定到多个结构相似的节点或节点组，从而复用颜色、位置等
动效，而不复制关键帧数据或依赖页面专属 Entity ID。

验收要点：

- 动画文件通过固定 `self` 和稳定命名槽位描述目标，消费节点负责把槽位映射到自身普通后代。
- 节点重命名不破坏槽位映射；节点移出宿主子树时保留原映射并显示诊断。
- 组件实例内部节点不作为 v1 槽位目标。
- 两个动画竞争同一节点的同一属性时，编辑器阻止新冲突；非法外部文档可确定性降级。

### US-05：用页面 setup 状态控制播放

作为实施工程师，我希望把节点 Animation 的 `play` 参数绑定到 setup 返回的 boolean 变量，从而用业务
数据声明式控制动画，而不需要 `useAutomation` 或按文件路径取得命令式播放器。

例如页面 setup 可以返回：

```ts
const playFault = computed(() => xx.value > 123)
const playAlarm = computed(() => xx.value > 123)

return { playFault, playAlarm }
```

随后分别把 `Fault.Animation.play` 和 `Alarm.Animation.play` 绑定到对应变量。

验收要点：

- `false → true` 按节点配置的 delay、speed 与 playback 从头播放。
- once 完成后在 `play=true` 期间保持末帧；`play=false` 立即恢复 authored 基础视觉。
- export 缺失、类型不是 boolean 或校验失败时回退 authored `play` 并显示非阻断诊断。
- 绑定只保存 `{ scope: 'page', exportName }`，不保存变量当前值。

### US-06：配置和预览播放行为

作为实施工程师，我希望在紧凑播放控制区播放、暂停、定位时间，并配置 once、loop、ping-pong、delay
与 speed，从而在保存前确认动画节奏。

验收要点：

- 播放区显示播放/暂停、Auto-keyframe、当前时间、总时长、时间单位和循环模式。
- Linear、Bezier、Spring 与 Hold 使用同一确定性 Runtime 计算。
- Stage 的编辑播放头优先于 setup 播放状态，关闭动画面板后立即恢复 authored 视觉。

### US-07：安全保存共享动画资源

作为实施工程师，我希望动画修改先保存在可撤销的本地草稿中，并在我明确保存后才写入资源 Provider，
从而避免编辑共享动画时静默覆盖他人的修改。

验收要点：

- 关键帧、值和 easing 编辑支持独立 Undo/Redo，且不进入页面文档历史。
- 保存使用读取时 revision；发生冲突时保留本地草稿，并允许重新加载或显式覆盖。
- 新建动画时先成功创建资源，再用一个文档事务绑定节点。
- 撤销节点绑定不会删除已经创建的动画文件。

### US-08：在 Preview 中可靠运行并局部降级

作为页面使用者，我希望不同告警节点按各自业务状态独立播放动画；即使某个动画资源损坏，页面其他
内容和动画仍然正常工作。

验收要点：

- `Fault` 与 `Alarm` 分别根据自己的 play value、delay、speed 和 playback 独立运行。
- 资源缺失、槽位失效或绑定错误只让对应动画恢复基础视觉并发布诊断。
- 页面切换或 Preview 卸载时释放时钟、资源订阅和迟到异步结果。
- 宿主未配置 Animation Store/Resolver 时，现有静态 Preview 行为保持兼容。
