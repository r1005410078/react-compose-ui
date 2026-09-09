## MODIFIED Requirements

### Requirement: 混合组件目录

组件面板 MUST 按一份**货架**（`sections`）渲染：每一段是一个来源——`presets`（Registry 中可见
Preset，按单项 `include` 勾选，`paletteHidden` 的 Preset MUST NOT 可勾选，判定见下）或 `folder`
（资源 Provider 里的一个文件夹路径，`groupBy` 为按子文件夹分组或平铺）；每段可默认折叠。面板 MUST 接受
`title` 与 `search`（跨段按名称过滤）。文件夹来源 MUST 按组件文件所在文件夹筛选与分组，因此
`ComposeComponentDescriptor` MUST 携带 `folderPath`，由 Store 从资源条目的 `parentId` 链推出；
新落入该文件夹的组件 MUST 自动出现，MUST NOT 提供文件夹来源里单个文件的显隐。文件夹不存在时
该段 MUST 渲染为一行「找不到」并可去掉，MUST NOT 让面板报错。瓦片样式 MUST 沿用既有两列瓦片。

右键瓦片 MUST 提供：基础组件的「从面板隐藏」；文件夹来源瓦片的「只看这一组」与「在资源里打开
此文件夹」；以及「自定义物料面板…」。这些项 MUST 以回调把货架的改动交给宿主，面板自身 MUST NOT
持久化货架。

面板 MUST 聚合主组件（Base）与变体（Variant），使用符合「主组件实心、变体可区分」规则的图标，
并将点击或拖拽转换为无 Stage 依赖的**实例创建意图**（引用对应资源）。未配置 Store 时 MUST 保持
Registry Preset 能力。从目录创建变体 MUST 使用显式菜单或动作，MUST NOT 与拖拽创建实例使用同一
默认路径。

`paletteHidden` MUST 按**两种来源**分别判定，MUST NOT 再当作一个恒定的布尔：

- **因为工具栏已提供入口而藏**（Arrow、Circle）：MUST 按**当前工作区的工具栏货架**判定——该
  工作区的货架含这条命令时藏，不含时该 Preset MUST 作为可见 Preset 出现在基础组件段里。
- **因为物料自身的理由而藏**（Wire：从面板拖出来的导线没有任何端口绑定，而那条粗线正在宣称
  它是主回路；Group、Frame、SVG、组件实例同理）：MUST 恒成立，与任何货架无关。

这条改写是「工具栏货架按工作区不同」的直接后果：原判据「工具栏已提供入口」在工具栏对所有
工作区相同时才是一个全局事实。不改写它，页面工作区里既没有 `CIRCLE` 按钮、又没有圆的瓦片，
而那条命令只剩命令行一条入口——收走一个入口是意图，收走全部可见入口不是。

#### Scenario: 页面里圆的瓦片出现

- **WHEN** 用户在页面工作区（默认货架不含 `CIRCLE`）查看基础组件段
- **THEN** 出现「圆」瓦片；切到绘图工作区后该瓦片消失，因为那里工具栏上有 `CIRCLE` 按钮

#### Scenario: 导线的瓦片两边都不出现

- **WHEN** 用户在任一工作区查看基础组件段，无论该工作区的货架含不含 `WIRE`
- **THEN** 没有「导线」瓦片——它藏起来的理由是拖出来的导线没有端口绑定，与工具栏无关

#### Scenario: 无 Store 保持兼容

- **WHEN** 宿主只提供 Registry
- **THEN** 面板继续列出和创建可见 Preset 且不显示项目资源错误

#### Scenario: 按子文件夹分组

- **WHEN** 货架含 `folder: Symbols`、`groupBy: 'subfolder'`，且 `Symbols` 下有 8 个子文件夹
- **THEN** 面板显示 8 个可折叠的组，各组标题为子文件夹名并带计数

#### Scenario: 右键基础组件瓦片

- **WHEN** 用户右键「布局容器」并选择「从面板隐藏」
- **THEN** 面板发出去掉该 Preset 的货架改动，瓦片消失

#### Scenario: 右键文件夹来源瓦片

- **WHEN** 用户右键 `Symbols / 开关` 里的「断路器」
- **THEN** 菜单里没有「从面板隐藏」，有「只看这一组」与「在资源里打开此文件夹」

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
