## ADDED Requirements

### Requirement: Stage 只渲染 WidgetSwitcher 的活动子项

Stage 场景层 MUST 跳过 core 派生的隐藏集合中的 Entity，与既有 `Visibility` 判断合并处理。切换活动
索引 MUST NOT 改变 Layout Snapshot——非活动子项仍参与布局求解，尺寸保持稳定。

#### Scenario: 只显示活动子项

- **WHEN** Stage 渲染含两个子项、`activeIndex` 为 0 的 WidgetSwitcher
- **THEN** 只有第一个子项及其后代出现在场景中
- **AND** 第二个子项的布局 box 与切换前一致

### Requirement: 选中 WidgetSwitcher 后代时临时预览该分支

选中 switcher 的任一后代时，Stage MUST 临时把该后代所在的直接子项显示出来以便编辑。该预览 MUST 是
表示层派生：MUST NOT 写入文档、MUST NOT 派发命令、MUST NOT 进入 Undo 栈；取消选择后 MUST 立即回到
`activeIndex`。

预览覆盖 MUST 同时作用于场景渲染与 SceneIndex，使被预览的分支既可见也可命中、可选中、可拖拽。

#### Scenario: 选中非活动子项

- **WHEN** 用户在场景树中选中 `activeIndex` 之外的某个子项的后代
- **THEN** 该子项分支在画布上显示并可直接命中拖拽
- **AND** 未产生任何文档事务，Undo 栈深度不变

#### Scenario: 取消选择后回到活动索引

- **WHEN** 用户清空选择
- **THEN** 画布重新只显示 `activeIndex` 指向的子项
