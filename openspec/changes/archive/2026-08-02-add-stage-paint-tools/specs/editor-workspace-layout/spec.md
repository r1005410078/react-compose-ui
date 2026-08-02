## ADDED Requirements

### Requirement: Editor 协调 Paint 编辑会话

ComposeEditor MUST 在每个实例内协调 Inspector Paint edit port、Stage 受控 paint target 和 Color History Provider。编辑 Popover 在 Stage canvas interaction 期间保持 pinned；退出 target 后恢复常规 Popover dismissal 和焦点。

#### Scenario: Inspector 与画布同步编辑

- **WHEN** 用户打开单个 Entity 的背景 Paint editor
- **THEN** Editor 激活对应 Stage Paint target 和实例级会话颜色历史
- **AND** 不改变 ComposeDocument、Selection 或 History，直到正式编辑提交
