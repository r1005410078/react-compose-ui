## 上下文

三个包要协作，但 `AGENTS.md` 的架构边界不允许它们互相认识：
`animation-panel` 不得依赖 `core`/`editor`/`stage`/`preview`，`property-panel` 不得依赖 `core`/`editor`。
因此 `editor` 必须是唯一知道"这条轨道对应哪个 Entity 的哪个属性"的地方，另外两个包只能拿到
不含动画语义的通用扩展点。

## 目标/非目标

- 目标：打开动画标签即进入动画模式；属性面板可动画字段有 Rive 式三态菱形；
  播放头驱动画布；自动记录时画布与属性面板的编辑写成关键帧。
- 非目标：不做画布运动路径（`add-stage-motion-path`）、不做曲线图编辑器、不做多动画切换 UI、
  不做动画列表管理、不做属性面板里的关键帧导航按钮。

## 决策

### 决策：`property-panel` 只加一个通用装饰插槽，不加"关键帧按钮"

面板行是固定三列 grid（`label | editor | actions`）。`actions` 栏容量由
`binding-entry-model.ts` 的 `slots = clamp(floor((actionWidth - 2) / 18), 1, 3)` 决定，
默认宽 38 只有 2 格，塞第三个按钮会把已有的绑定与重置动作挤进溢出菜单。
`labelComponent` 会替换整个标签单元，不能与内建标签共存。

所以新增 `renderFieldAdornment`，渲染在标签文本之后、标签单元之内。它拿到 `path`、`schema`、
`metadata`、`label` 和 `value`，返回任意节点。`property-panel` 不知道返回的是不是菱形。

考虑过的替代方案：
- **在 metadata 里加 `animatable` 标志** —— 会把动画语义写进一个不认识文档的包。
- **开放 `RowAction` 让宿主往 actions 栏塞项** —— 与容量算法冲突，且动作栏语义是"对该字段的操作"，
  打点是模式相关的，混在一起会让溢出菜单在动画模式下抖动。

### 决策：`animation-panel` 新增 `onAction`，而不是让宿主 diff 快照

provider 目前每次变更只吐完整 `ComposeAnimationPanelValue`，播放时约 60 次/秒。宿主要把
"用户拖动了 200 ms 那个关键帧"从两份快照里 diff 出来既脆弱又昂贵。`onAction` 直接给出语义动作，
宿主翻译成命令。`onValueChange` 保留，非受控与纯 UI 用法不受影响。

### 决策：播放头是编辑器会话状态，永不进文档

`currentTimeMs`、`isPlaying`、`autoRecord` 和选择状态都留在 editor 的 React 会话里。
它们进文档会让每帧播放都产生一条事务，撤销栈瞬间被淹没。文档只存动画本身。

### 决策：画布拿到的是采样后的派生文档，dispatch 永远打在基础文档上

动画模式下把 `@compose-ui/animation` 的
`applyComposeAnimationAtTime(document, animationId, playheadMs)` 结果作为 `document`
传给 Stage、LayoutRuntime 与 Preview；`dispatch` 仍然是基础文档的 dispatch。

**这里有一个必须显式处理的陷阱**：`entity.transform.set` 的 payload 带
`operation: 'move' | 'resize' | 'rotate' | 'set'`，其中 move 语义可能是增量。用户在采样文档上
拖动时，增量是相对采样值的；如果直接落到基础文档，就会叠加到未动画的原值上，位置立刻跳掉。
因此自动记录的翻译层 MUST 先把命令结果折算成**绝对值**再写关键帧，并且必须有专门的回归测试
覆盖"播放头不在 0 ms 时拖动对象"。

### 决策：菱形的四种状态，其中 `unavailable` 是本项目特有的

Rive 只有三态。本项目多一个 `unavailable`：`LayoutItem.offset` 只在 `positioning: 'absolute'`
下参与求解，`width/height.value` 只在 `mode: 'fixed'` 下生效。在 Flow 布局或 Fill/Hug 尺寸下
打点会产生一条永远看不到效果的轨道，所以菱形置灰禁用并给出说明性 accessible name。

### 决策：vector2 轨道在时间线上显示成两行，但共享一个 `propertyId`

`ComposeAnimationPropertyTrack` 已有 `groupLabel` + `channel`，足以显示 `Position · X` /
`Position · Y`。两行指向同一条轨道，因此关键帧在两行上同步出现、同步移动——这正确反映了
"位置是一个二维量"的事实，也避免了用户在 X 行删掉一个帧而 Y 行还留着。

## 风险/权衡

- **播放时每帧 setState 会重渲编辑器** → 播放头单独用一个 context，避免整个 controller 重渲；
  先测帧率再决定是否需要更细的订阅。
- **`animation-panel` 的破坏性类型变更** → 包未发布，宿主只有仓库内的 `editor` 与 `storybook`，
  随本变更一次性更新调用点。
- **吸收 `update-animation-panel-foundation` 会让本提案变大** → 那五项都是接真实数据的前提
  （尤其 `trackId` 必填与删除 label 启发式），分开做会先写一遍启发式再删掉。

## 迁移计划

`update-animation-panel-foundation` 尚未实施，其 tasks 并入本变更的清单；本变更完成后
用 `openspec archive update-animation-panel-foundation --skip-specs --yes` 归档。

## 待解决问题

- 一个文档可以有多条动画，本变更只使用第一条（不存在时按需创建）。动画列表 UI 待定。
