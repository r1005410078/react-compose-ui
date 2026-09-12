## MODIFIED Requirements

### Requirement: 混合组件目录

组件面板 MUST 按一份**货架**（`sections`）渲染：每一段是一个来源——`presets`（Registry 中可见
Preset，按单项 `include` 勾选，`paletteHidden` 的 Preset MUST NOT 可勾选）或 `folder`（资源
Provider 里的一个文件夹路径，`groupBy` 为按子文件夹分组或平铺）；每段可默认折叠。面板 MUST 接受
`title` 与 `search`（跨段按名称过滤）。文件夹来源 MUST 按组件文件所在文件夹筛选与分组，因此
`ComposeComponentDescriptor` MUST 携带 `folderPath`，由 Store 从资源条目的 `parentId` 链推出；
新落入该文件夹的组件 MUST 自动出现，MUST NOT 提供文件夹来源里单个文件的显隐。文件夹不存在时
该段 MUST 渲染为一行「找不到」并可去掉，MUST NOT 让面板报错。瓦片样式 MUST 沿用既有两列瓦片。

面板 MUST 聚合主组件（Base）与变体（Variant），使用符合「主组件实心、变体可区分」规则的图标，
并将点击或拖拽转换为无 Stage 依赖的**实例创建意图**（引用对应资源）。未配置 Store 时 MUST 保持
Registry Preset 能力。从目录创建变体 MUST 使用显式菜单或动作，MUST NOT 与拖拽创建实例使用同一
默认路径。

#### Scenario: 无 Store 保持兼容

- **WHEN** 宿主只提供 Registry
- **THEN** 面板继续列出和创建可见 Preset 且不显示项目资源错误

#### Scenario: 按子文件夹分组

- **WHEN** 货架含 `folder: Symbols`、`groupBy: 'subfolder'`，且 `Symbols` 下有 8 个子文件夹
- **THEN** 面板显示 8 个可折叠的组，各组标题为子文件夹名并带计数

#### Scenario: 新导入的符号自动出现

- **WHEN** 用户向 `Symbols/变电站` 导入一个新的组件文件
- **THEN** 不改任何设置，它出现在对应的组里

#### Scenario: 搜索跨段

- **WHEN** 用户在搜索框输入「终端」
- **THEN** 所有段里只剩名称匹配的瓦片，段标题保留

#### Scenario: 文件夹不存在

- **WHEN** 货架引用的文件夹已被删除
- **THEN** 该段显示「找不到」并提供去掉入口，其余段正常

#### Scenario: 区分主组件与变体

- **WHEN** Store 返回 Base 与 Variant 描述
- **THEN** 两者显示不同图标、accessible name、稳定资源引用
- **AND** 变体可识别其父源

#### Scenario: 拖拽仅产生实例意图

- **WHEN** 用户拖拽主组件或变体目录项
- **THEN** 发出的创建意图为实例化该引用
- **AND** 不包含隐式 createVariant 资源写入
