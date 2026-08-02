## ADDED Requirements

### Requirement: Paint SVG Overlay 与采样适配

ComposeStage MUST 仅根据 Engine snapshot 渲染线性、径向、角向的可访问 SVG 控制柄和 sample hover。控制柄仅在单选实体的背景 Paint editor 打开时显示；React adapter 负责 pointer capture、native client 坐标和 effect 应用，不得实现 Paint 几何。

#### Scenario: 退出 Paint 编辑

- **WHEN** Popover 关闭、选择变更、Escape、blur、pointercancel 或 document 变更
- **THEN** Stage 清除 Paint overlay 与 preview
- **AND** 非正常结束不产生事务
