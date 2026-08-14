# 变更：新增动画时间轴与自动刻帧编辑器

## Why

`add-animation-asset-runtime` 让动画资源可以被绑定和播放，但资源本身只能手写 JSON。实施工程师需要
在画布上直接改属性就得到关键帧，并能在时间轴上检查、移动和调整每一帧。

底部动画面板、时间轴与关键帧 Inspector 的界面以 `design/animation.png` 设计稿为视觉与交互基准，
细节见 design.md「上下文」小节。

## What Changes

- 新增容器范围、全宽底部动画时间轴：聚合当前 Hierarchy 容器后代的 Animation，按节点显示持续区间
  并在节点下展开属性轨道，同时只有一个动画资源处于可编辑状态。
- 新增默认开启的 Auto-keyframe：Editor 的 recording adapter 把视觉安全属性命令转换为动画草稿操作，
  自动建立轨道与关键帧；关闭时全部属性编辑恢复原 ComposeDocument 命令语义。
- 新增窄口径「添加轨道」入口，**只对没有 authored 对应字段的通道开放**（v1 仅 scale），其余四个
  通道仍只能由 Auto-keyframe 产生。
- 新增关键帧/区间上下文 Inspector：帧序号、时间、值与进入该帧的 easing；区间选择切换为 Curve、
  Spring、Hold 编辑器。
- 新增动画编辑会话：独立于页面文档历史的草稿与 Undo/Redo、显式保存、revision 冲突处理与 dirty
  关闭保护。
- Stage 在动画编辑时应用受控播放头的 FrameSnapshot，优先于 setup 的 play 值。

## Impact

- 受影响的规范：`animation`、`editor-workspace-layout`、`stage`、`basic-materials`
- 受影响的代码：`packages/animation`（React 子入口新增时间轴、Inspector、编辑会话）、
  `packages/editor`（bottom Edge Group 标签、recording adapter、选择协调）、`packages/stage`
  （受控帧覆盖）、`packages/materials`（声明布局属性不可动画）
- 依赖：`add-animation-asset-runtime`
- 兼容性：不改变文档协议。未打开动画面板、未注入 Animation 配置的编辑器行为不变。

## User Stories

### US-01：在画布上刻制节点动画

作为实施工程师，我希望打开动画面板后直接在画布上修改属性，由系统自动识别属性轨道和关键帧，
而不需要手动添加动画属性。

验收要点：

- 打开底部「动画」标签后，时间轴横跨整个编辑器底部。
- Auto-keyframe 默认开启；在 0ms 保持白色、移动到 300ms 后改成红色，会自动得到颜色轨道及首尾关键帧。
- 修改关键帧只更新动画草稿，不修改节点 authored 属性，也不写入页面文档历史。
- 关闭 Auto-keyframe 后，属性编辑恢复原有 ComposeDocument 命令语义。

### US-02：查看和编辑多关键帧时间线

作为实施工程师，我希望时间轴明确展示节点、属性轨道、播放头和全部关键帧，从而可以精确检查和调整
四帧或更多帧的动画。

验收要点：

- 0、100、200、300ms 的四个关键帧显示为四个独立菱形，并能被逐个选择、移动和删除。
- 选择第三帧时，右侧 Inspector 显示 `3/4`、200ms、当前属性值以及进入该帧的 easing。
- 选择两帧之间的区间时，右侧 Inspector 切换为 Curve、Spring 或 Hold 编辑器。
- 清除时间轴选择后，右侧 Inspector 恢复显示当前节点及其 Animation 能力。

### US-03：聚合查看容器中的多个动画

作为实施工程师，我希望选择一个容器后，在同一时间轴中查看 `Fault`、`Alarm` 等后代节点的动画，
从而协调一组告警动效。

验收要点：

- 时间轴按节点显示持续区间，并在节点下展开系统自动识别的属性轨道。
- 点击某个节点或轨道只切换当前活动动画资源，不改变 Scene Tree 层级。
- 容器播放头只用于聚合编辑预览，不成为 Preview 的共享时钟。

### US-04：配置和预览播放行为

作为实施工程师，我希望在紧凑播放控制区播放、暂停、定位时间，并配置 once、loop、ping-pong、delay
与 speed，从而在保存前确认动画节奏。

验收要点：

- 播放区显示播放/暂停、Auto-keyframe、当前时间、总时长、时间单位和循环模式。
- 时间轴显示的是**资源本地时间**；delay 与 speed 只影响区间的可视化呈现，不参与关键帧寻址。
- Stage 的编辑播放头优先于 setup 播放状态，关闭动画面板后立即恢复 authored 视觉。

### US-05：安全保存共享动画资源

作为实施工程师，我希望动画修改先保存在可撤销的本地草稿中，并在我明确保存后才写入资源 Provider，
从而避免编辑共享动画时静默覆盖他人的修改。

验收要点：

- 关键帧、值和 easing 编辑支持独立 Undo/Redo，且不进入页面文档历史。
- 撤销快捷键的路由由动画面板可见性与焦点确定，且不跨栈撤销。
- 保存使用读取时 revision；冲突时保留本地草稿，并允许重新加载或显式覆盖。
- 自动创建的槽位映射先留在草稿，资源保存成功后再提交映射事务。
