## MODIFIED Requirements

### Requirement: 版本化 ECS JSON 文档

系统 MUST 在 `@compose-ui/core` 提供只接受 `schemaVersion: 6` 的严格 JSON ComposeDocument。
每个场景 Entity MUST 具有 Composition、Transform、LayoutItem、Visibility 与 Lock，并至少具有
Renderer 或 Hierarchy。Transform MUST 只保存 rotation；LayoutItem MUST 保存局部 box authoring
意图。v5 和其他版本 MUST 被普通 parser 拒绝。

#### Scenario: 接受 v6 并拒绝旧版本
- **WHEN** 候选文档具有完整合法的 v6 ECS 组件
- **THEN** parser 返回保留全部合法未知 Component 的 ComposeDocument
- **AND** v5、旧 Transform 形状或缺少 LayoutItem 的候选被稳定拒绝

### Requirement: 可选 Flex Layout Component

Layout MUST 只与 Hierarchy 组合，并保存明确的 Flex direction、wrap、alignContent、
justifyContent、alignItems、四边 padding、rowGap 与 columnGap。Flow LayoutItem MUST 仅位于直接拥有
Layout 的 parent 下；根级或 free parent 的子项 MUST 为 Absolute。

#### Scenario: 校验 Flow 与 Absolute 位置模式
- **WHEN** Layout parent 包含 Fixed Flow 与 Absolute 子项
- **THEN** 文档通过校验且 Hierarchy.childIds 决定 Flow 顺序
- **AND** 根级 Flow、free parent 下 Flow 或非法数值被拒绝

## ADDED Requirements

### Requirement: 显式 v5 到 v6 迁移

Core MUST 发布纯函数迁移器，先严格验证 v5，再返回经过 v6 validator 的新文档或可定位 issues。
迁移 MUST 不修改输入、保留未知合法 Component，并把所有既有子项转为 Absolute 以保持视觉。

#### Scenario: 迁移合法 v5 文档
- **WHEN** 宿主向迁移器传入带嵌套 Transform、Layout、constraints 和未知 Component 的合法 v5
- **THEN** 返回 rotation-only Transform、Fixed LayoutItem、GeometryConstraints 和 v6 Layout
- **AND** 原输入、世界视觉、Hierarchy 顺序与未知数据保持不变

