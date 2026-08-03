## ADDED Requirements

### Requirement: 共享外观与 overflow 行为解耦

共享 Registry 渲染基础 MUST 提供不包含消费方 overflow 决策的 Entity appearance 样式入口，
同时保持既有公共视觉样式入口兼容。

#### Scenario: Stage 与 Preview 选择不同 overflow 行为

- **WHEN** 两个消费方渲染同一个配置了滚动的容器
- **THEN** 它们复用相同 appearance，但分别应用静态编辑语义和原生预览语义
