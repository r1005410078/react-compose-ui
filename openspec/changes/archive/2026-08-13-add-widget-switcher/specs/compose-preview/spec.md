## ADDED Requirements

### Requirement: Preview 只渲染 WidgetSwitcher 的活动子项

Preview MUST 跳过 core 派生的隐藏集合中的 Entity，只渲染每个 WidgetSwitcher 的活动子项。Preview
MUST NOT 应用任何编辑期预览覆盖——运行期只认 `activeIndex`。嵌套文档 Runtime（Component Instance
与 Page Slot）MUST 遵守同一规则。

#### Scenario: 运行期只显示活动子项

- **WHEN** Preview 渲染含三个子项、`activeIndex` 为 1 的 WidgetSwitcher
- **THEN** 只有第二个子项及其后代出现在输出中

#### Scenario: 嵌套文档中的 switcher

- **WHEN** Component Instance 或 Page Slot 的内部文档含 WidgetSwitcher
- **THEN** 嵌套 Runtime 同样只渲染其活动子项
