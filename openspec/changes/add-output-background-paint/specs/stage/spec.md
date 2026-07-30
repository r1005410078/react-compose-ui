## ADDED Requirements

### Requirement: Stage 输出背景 Paint

ComposeStage MUST 在固定输出边界渲染 `output.backgroundPaint` 的共享 Paint 描述，并让输出背景保持
不可交互、不可选中和不参与 Entity Paint edit/sample session。

#### Scenario: 编辑渐变输出背景

- **WHEN** Canvas Inspector 提交合法的输出 Gradient Paint
- **THEN** Stage 在下一文档快照显示对应输出渐变
- **AND** 现有 Entity 选择、移动、命中测试和渐变控制柄目标保持不变
