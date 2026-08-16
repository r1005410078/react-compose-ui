## ADDED Requirements

### Requirement: Unity 对齐的主组件、变体与实例产品语义

系统 MUST 以与 Unity Prefab 体系同构的三层产品语义呈现组件能力：主组件（Base 资源）、变体
（Variant 资源，继承直接父源）、实例（页面上的 component-instance）。产品文案 MUST 使用「主组件」
「变体」「实例」；变体资源 MUST 能展示其直接父源的显示名（「基于 {父名}」）。拖入画布与复制实例
MUST NOT 隐式创建新的变体资源文件。

#### Scenario: 三层用语固定

- **WHEN** 用户在组件库查看 Base 与 Variant，并在页面选中 component-instance
- **THEN** 界面分别以主组件、变体、实例语义标识，且变体显示基于其父源

#### Scenario: 拖入不建变体

- **WHEN** 用户从组件库将主组件或变体拖入画布
- **THEN** 仅创建引用该资源的实例
- **AND** 组件库中不新增变体文件

### Requirement: 从实例创建变体对齐 Unity Prefab Variant

系统 MUST 提供显式「创建变体」动作。从页面实例创建时，新变体的父源 MUST 为实例当前引用的组件，
变体 overrides MUST 来自实例本层结构覆盖；创建成功后 MUST 默认将该实例的引用切换为新变体并清除
已固化到变体中的本层覆盖。创建变体 MUST NOT 作为复制实例或拖入画布的默认副作用。

#### Scenario: 实例另存为变体并改绑

- **WHEN** 用户对含本层覆盖的实例执行创建变体并确认名称
- **THEN** 库中新增 Variant 资源，其父引用为原实例引用，overrides 含原本层操作
- **AND** 该实例改为引用新变体且本层覆盖被清空

#### Scenario: 复制实例不创建变体

- **WHEN** 用户复制页面上的组件实例
- **THEN** 得到新的实例实体且 reference 与源实例相同
- **AND** 不创建新的变体资源

### Requirement: 主组件与变体的图标区分

组件库与资源列表中，主组件 MUST 使用实心组件符号图标，变体 MUST 使用可区分的变体图标（空心同形
或实心加侧向条纹，全产品一致）。图标差异 MUST NOT 仅依赖颜色。accessible name MUST 能区分主组件
与变体。

#### Scenario: 库列表可区分主组件与变体

- **WHEN** 组件库同时列出同一业务名的主组件与其变体
- **THEN** 两者图标形态不同且辅助技术名称可区分
- **AND** 变体展示基于父源的信息

### Requirement: 实例覆盖写回直接父源（含主组件）缺陷修复

系统 MUST 保证页面 component-instance 的本层结构覆盖可通过 Apply（单项或全部）写入其**直接
父源**资源：父源为 Base 时 MUST 更新并保存主组件文档；父源为 Variant 时 MUST 更新并保存该变体。
经实例根或实例内部编辑产生的、应对齐 Unity「Apply to Prefab」的改动 MUST 进入
`instanceOverrides.operations`，不得仅停留在无法 Apply 的瞬时状态。Apply 完成后 MUST 在同一
产品流程中更新发起实例的 `resolvedSnapshot` 与剩余 `instanceOverrides`；若资源已保存而场景
事务失败，MUST 向用户说明父源已更新且提供恢复/重试路径，不得静默丢弃。写回主组件成功后，
其他引用同一主组件且覆盖兼容的实例 MUST 能通过既有自动同步或显式检查更新获得新快照。

#### Scenario: 引用主组件的实例 Apply 写回 Base

- **WHEN** 页面实例直接引用主组件，且本层存在至少一条结构覆盖（例如根外观或尺寸）
- **AND** 用户对该覆盖执行 Apply 或 Apply 全部
- **THEN** 主组件资源文档包含该覆盖结果并完成保存
- **AND** 发起实例的本层覆盖不再包含已消费操作，resolvedSnapshot 与主组件解析结果一致

#### Scenario: 根属性编辑可被 Apply

- **WHEN** 用户在选中实例时通过实例根属性通路修改应对齐组件根的字段
- **THEN** 修改以结构操作形式进入 instanceOverrides
- **AND** Apply 全部时父源（主组件或变体）被更新，而非因 operations 为空而跳过写入

#### Scenario: 父源已写场景未更新时的可恢复失败

- **WHEN** Apply 已成功保存直接父源但更新发起实例的场景事务未提交
- **THEN** 用户可见明确失败或警告状态
- **AND** 可通过重试或检查更新使该实例快照与父源对齐，且父源不被错误回滚

#### Scenario: 写回主组件后其他实例可同步

- **WHEN** 实例 A 将覆盖 Apply 到主组件成功
- **AND** 实例 B 引用同一主组件且无冲突本层覆盖
- **THEN** 实例 B 经自动同步或用户检查更新后呈现主组件上的对应变更

## MODIFIED Requirements

### Requirement: 混合组件目录

组件面板 MUST 聚合 Registry 中可见 Preset、主组件（Base）与变体（Variant），使用符合「主组件实心、
变体可区分」规则的图标，并将点击或拖拽转换为无 Stage 依赖的**实例创建意图**（引用对应资源）。
未配置 Store 时 MUST 保持现有 Registry Palette 能力。从目录创建变体 MUST 使用显式菜单或动作，
MUST NOT 与拖拽创建实例使用同一默认路径。

#### Scenario: 无 Store 保持兼容

- **WHEN** 宿主只提供 Registry
- **THEN** 面板继续列出和创建可见 Preset 且不显示项目资源错误

#### Scenario: 区分主组件与变体

- **WHEN** Store 返回 Base 与 Variant 描述
- **THEN** 两者显示不同图标、accessible name、稳定资源引用
- **AND** 变体可识别其父源

#### Scenario: 拖拽仅产生实例意图

- **WHEN** 用户拖拽主组件或变体目录项
- **THEN** 发出的创建意图为实例化该引用
- **AND** 不包含隐式 createVariant 资源写入
