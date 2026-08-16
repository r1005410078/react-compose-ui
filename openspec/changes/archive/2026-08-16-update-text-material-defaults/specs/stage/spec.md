## MODIFIED Requirements

### Requirement: 直接绘制 Preset

Stage MUST 为 container、rectangle、line、arrow、circle 与 text 提供受控绘制工具。绘制工具 MUST 在拖拽期间展示瞬时预览，正常松手时通过 Registry Preset 创建一个合法 Entity，取消时不得产生文档事务。

#### Scenario: 拖拽绘制容器与形状

- **WHEN** 用户在任一 container 或 shape 绘制工具中从 surface 拖出有效 bounds 并松手
- **THEN** Stage 创建一个具有相同规范化世界 bounds 的对应 Preset Entity
- **AND** 该 Entity 成为选区，写入一个可撤销事务后请求切换到 select 工具，避免后续点击继续绘制

#### Scenario: 点击或拖拽绘制文字

- **WHEN** 用户使用 text 工具点击 surface
- **THEN** Stage 在点击点创建保留 Text Preset `hug × hug` 轴的文字，初始预览使用 Text 的默认回退尺寸
- **AND** Layout measurement 完成后选区贴合实际文字内容
- **WHEN** 用户使用 text 工具拖拽 surface
- **THEN** Stage 创建两轴为 `fixed` 且使用精确拖拽 bounds 的 text box
- **AND** Escape、pointercancel 或无效 geometry 不创建 Entity
