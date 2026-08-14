## ADDED Requirements

### Requirement: Stage 受控动画帧预览

Stage MUST 接受可选的 Animation FrameSnapshot，并在既有 LayoutSnapshot 与 Entity 视觉样式之上应用
位置、旋转、缩放、透明度和纯色背景覆盖。普通编辑模式 MUST 不自行启动正式播放器；动画编辑会话的
受控播放头 MUST 优先于页面 setup 的 play 值。覆盖变化 MUST 精确刷新目标 Entity，不得提交文档命令、
触发布局求解或重置选择。

#### Scenario: 拖动播放头预览颜色
- **WHEN** 用户把白色到红色动画的播放头拖到中间时间
- **THEN** Stage 使用 Runtime FrameSnapshot 显示中间颜色
- **AND** Appearance authored 背景、History 与 LayoutSnapshot 保持不变

#### Scenario: 动画预览与编辑手势共存
- **WHEN** Stage 正显示受控动画帧且用户选择节点或平移画布
- **THEN** 既有命中、选择、viewport 和 Overlay 行为保持可用
- **AND** 动画帧不被误提交为移动、旋转或 Appearance 命令

#### Scenario: 清除动画预览
- **WHEN** 用户关闭动画面板或退出活动动画资源
- **THEN** Stage 立即移除 FrameSnapshot 并恢复 authored 视觉
- **AND** 不需要 Undo 或文档回滚

