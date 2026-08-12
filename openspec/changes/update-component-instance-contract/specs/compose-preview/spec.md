## MODIFIED Requirements

### Requirement: 组件实例预览

Preview MUST 从实例保存的 resolvedSnapshot 递归渲染组件内容，按实例结构操作解析 Renderer props，
保留内部真实预览交互，并且不依赖实时 Component Store。Preview MUST 与 Stage 共享八层嵌套、
循环检测、错误占位和 dispose 行为，但 MUST NOT 暴露编辑期的内部选中、下钻或结构编辑能力。

#### Scenario: 预览在线与离线组件实例

- **WHEN** 文档包含合法 component-instance，且 Provider 在线或离线
- **THEN** Preview 均按保存快照与结构操作渲染相同输出
- **AND** 内部预览事件保持可用

#### Scenario: 预览不暴露编辑期能力

- **WHEN** 实例含实例层结构操作且 Preview 渲染该实例
- **THEN** 输出反映解析后的结构，但不提供内部节点选区、下钻手势或编辑命中

#### Scenario: 拒绝非法嵌套

- **WHEN** 保存快照递归引用自身或超过八层
- **THEN** Preview 只在该实例位置显示可访问错误，不中断文档其余内容
