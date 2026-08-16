## ADDED Requirements

### Requirement: 实例与组件文档的标题语义

默认 Editor 在选中页面 component-instance 时，属性区标题语义 MUST 标明「实例」。打开主组件文档
会话时 MUST 标明「主组件」；打开变体会话时 MUST 标明「变体」并展示基于父源。实例头栏的「创建变体」
MUST 为显式动作，文案 MUST 说明将另存为组件库资源（而非复制页面节点）。

#### Scenario: 选中实例显示实例语义

- **WHEN** 用户在页面上选中 component-instance
- **THEN** 属性头或等价区域出现实例语义（如「实例 · …」）
- **AND** 提供创建变体入口且不与复制实例混淆

#### Scenario: 打开变体文档显示基于父源

- **WHEN** 用户打开 kind 为 variant 的组件文档
- **THEN** UI 标明变体并展示基于父源的显示名

### Requirement: 资源拖入画布仅实例化

从 Asset Browser 或等价资源入口将组件媒体类型拖入 Stage 时，系统 MUST 创建 component-instance
实例并绑定该资源引用，MUST NOT 因此自动创建新的变体资源文件。

#### Scenario: 资源拖入创建实例

- **WHEN** 用户将已有主组件或变体资源拖入画布并成功落点
- **THEN** 文档中新增实例实体引用该资源
- **AND** Provider 中组件文件数量不因该次拖入而增加变体文件
