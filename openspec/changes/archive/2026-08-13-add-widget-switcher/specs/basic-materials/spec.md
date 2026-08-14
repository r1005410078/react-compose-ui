## ADDED Requirements

### Requirement: WidgetSwitcher 物料与切换能力

Materials MUST 发布 `widget-switcher` Entity Preset：Component 组合与 Container 一致（Transform、
LayoutItem、Visibility、Lock、Hierarchy、Clip、Appearance），并额外携带
`WidgetSwitcher: { activeIndex: 0 }`。该 Preset MUST 出现在默认 Palette 中——它没有其他创建入口。

Materials MUST 注册 `widget-switcher` 内建能力。该能力 MUST 只创建 `WidgetSwitcher` 一个
Component——能力添加会拒绝已存在的 Component Key，连带创建 Hierarchy/Clip 会让「给已有容器追加切换
语义」这一主用法被判为冲突。添加该能力 MUST NOT 改动目标已有的 `childIds`；移除该能力 MUST 只移除
切换语义，子项全部保留。

Materials MUST 为 `WidgetSwitcher` 注册带 Inspector 的 Component 定义，用于编辑活动索引并呈现当前
子项数量。Inspector 一次编辑 MUST 只派发一条 Component 更新命令。

子项 MUST 沿用现有 `LayoutItem` 语义：WidgetSwitcher MUST NOT 引入 switcher 专属的 padding、对齐或
强制填满规则，也 MUST NOT 覆盖用户为子项设置的 Flow/Absolute 与尺寸。

#### Scenario: 创建 WidgetSwitcher

- **WHEN** Registry 从 `widget-switcher` Preset 创建 seed
- **THEN** seed 是合法独立 ComposeEntity，带空 Hierarchy 与 `activeIndex: 0`
- **AND** Composition 记录 `widget-switcher` Preset 与其基础 Component Keys

#### Scenario: 给已有容器追加切换能力

- **WHEN** 用户向一个含子项的 Container 添加切换能力
- **THEN** 该 Container 获得 `WidgetSwitcher` 且 `childIds` 不变
- **AND** 画布上只显示 `activeIndex` 指向的子项

#### Scenario: Inspector 切换活动索引

- **WHEN** 用户在 Inspector 把活动索引从 0 改为 1
- **THEN** 只派发一条更新 `WidgetSwitcher` 的命令
- **AND** Undo 一次即恢复原索引，子项的 LayoutItem 与 Visibility 不变
