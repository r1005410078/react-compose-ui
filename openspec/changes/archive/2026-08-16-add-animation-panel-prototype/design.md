## 上下文

参考图把时间线置于编辑器底部，把关键帧属性置于右侧。本期只完成可独立嵌入的 UI 组件，
不把演示轨道误建模为页面动画协议，也不让时间线连到画布实体。

## 目标/非目标

- 目标：提供遵循参考视觉的底部时间线、右侧关键帧属性面板、三种本地播放模式和可拖动/键盘调整的关键帧编辑体验。
- 目标：允许宿主把两个视觉区域分开挂载，仍共享选择和播放头状态。
- 非目标：ComposeDocument Schema、动画持久化、Stage/Preview 实际播放、自动从选区生成轨道、Undo/Redo。

## 决策

- 决策：发布 `ComposeAnimationPanelProvider`、`ComposeAnimationTimeline`、`ComposeAnimationInspector`。
  Provider 提供一个完整 `value/defaultValue/onValueChange` 会话，时间线与 Inspector 只消费此会话。
- 决策：默认值是 300 ms 的 `Fault / 背景填充` 演示轨道，四个关键帧位于 0、100、200、300 ms，
  默认选择 200 ms 的红色 `#FF6B6B` Linear 关键帧。
- 决策：时间指针、播放/暂停、播放模式、自动记录开关、关键帧选择和字段编辑只修改 Provider 状态。
  `play-once` 抵达末尾时停止，`loop` 从 0 ms 继续，`ping-pong` 在两个端点间反向往返。
- 决策：关键帧属性时间限制在 0～duration；同一轨道/属性内不允许重复时间，冲突时保留原值并给出可访问提示。
- 决策：关键帧通过 Pointer capture 水平拖动，以 10 ms 吸附；同一动作可用 ArrowLeft/ArrowRight 每次移动 10 ms。
  拖动、键盘移动和 Inspector 时间字段使用同一去重规则，并始终选中被移动的关键帧。关键帧选择和编辑
  与预览播放头分离，不能改变当前播放位置。
- 决策：包只依赖 React 与 `@compose-ui/ui-context`；主题通过 Context token，组件内建中英文文案。
- 决策：`@compose-ui/editor` 作为上层 Shell 依赖动画包，在默认底部工具组新增“动画”标签。
  同一个 Provider 包裹工作区；只有底部动画标签激活时，右侧 Inspector 替换为关键帧属性面板。
  点击右侧属性区本身不会退出动画模式，切回资源、命令或日志标签时恢复普通 Inspector。

## 风险/权衡

- 演示数据可能被误解为领域模型 → API 明确命名为 Panel Value，文档和测试明确其仅为会话状态。
- 分离挂载的组件缺少 Provider → 抛出清晰错误，避免静默的不同步状态。
- 小高度时轨道信息拥挤 → 固定控制栏和轨道列表宽度，时间轴内容横向滚动并保留播放头。

## 迁移计划

无数据迁移。Editor 仅作为 Provider 宿主，不改变动画包的无画布、无文档边界。
