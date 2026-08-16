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

**payload 语义结论（任务 5.1 考证）**：`entity.transform.set` 的 `updates[].transform` 是
**绝对值**——完整的目标 `ComposeSpatialTransform`（position/size/rotation），`operation` 只影响
约束校验与 patch 写法（move 会把 flow item 烘焙成 absolute，resize/set 会把变化轴烘焙成
fixed），不存在增量语义。因此改写层不需要折算增量；真正的陷阱变成**命令一旦放行到基础文档
就会把采样值写成静态值**：用户在采样文档上拖动，Stage 发出的绝对位置是"基础值 + 动画偏移"
的合成结果，直接落地等于把播放头时刻的姿态烘焙进文档。所以自动记录开启时改写层拦截命令、
只派发 `animation.keyframe.set`，原命令不再派发；仍然必须有回归测试覆盖"播放头不在 0 ms 时
拖动对象"（断言基础静态值与 0 ms 帧都不变）。

改写层还需要一个**变化基线**来判断哪些通道真的变了：来自画布手势的
`operation: 'move' | 'resize' | 'rotate'` 与采样文档比（用户看到并拖动的是采样值）；来自
Inspector 的 `operation: 'set'`、`entity.component.update` 与 `entity.appearance.set` 与基础
文档比（Inspector 当前显示的是基础值）。任一变化通道不可动画（Flow 布局的 offset、非 fixed
的宽高、非纯色 Paint、margin 等白名单外字段）时整条命令原样放行，不做部分改写——半改写会把
一次用户操作拆成"一半进关键帧、一半进静态值"的不可理解状态。

### 决策：菱形的四种状态，其中 `unavailable` 是本项目特有的

Rive 只有三态。本项目多一个 `unavailable`：`LayoutItem.offset` 只在 `positioning: 'absolute'`
下参与求解，`width/height.value` 只在 `mode: 'fixed'` 下生效。在 Flow 布局或 Fill/Hug 尺寸下
打点会产生一条永远看不到效果的轨道，所以菱形置灰禁用并给出说明性 accessible name。

### 决策：vector2 轨道在时间线上是单行，分量编辑在关键帧属性面板

最初设想显示成 `Position · X` / `Position · Y` 两行（Rive 式），但面板的轨道模型是
"一条轨道一行"，两行同步渲染需要给面板发明一套行分身与选中/拖拽联动机制。放弃：
单行 `Position` 轨道 + Inspector 的 X/Y 双分量输入表达同样的事实，代价小一个量级，
且天然避免"删了 X 行的帧、Y 行还留着"的伪状态。

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
