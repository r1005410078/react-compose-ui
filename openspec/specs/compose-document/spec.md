# compose-document Specification

## Purpose
TBD - created by archiving change add-command-transaction-runtime. Update Purpose after archive.
## Requirements
### Requirement: 可持久化画布设置与辅助线

ComposeDocument v4 MUST 保存 grid、smartSnap 与全局世界坐标 guides。Grid stepX/stepY MUST 为有限
正数，offsetX/offsetY MUST 为有限数，primaryLineEvery MUST 为正整数；guide ID MUST 非空且唯一，
axis MUST 为 `x|y`，position MUST 为有限数。

#### Scenario: 创建默认画布设置

- **WHEN** 宿主调用 `createDefaultCanvasSettings`
- **THEN** 得到 8×8、零偏移、每 8 格主线且三类吸附开启的独立 JSON
- **AND** guides 初始为空且多次调用不共享可变对象

#### Scenario: 保存全局辅助线

- **WHEN** v4 文档包含位于正负世界坐标的合法水平和垂直辅助线
- **THEN** 校验保留 guide 顺序、ID、axis 与 position
- **AND** guides 不依赖任何 Container Entity 或 viewport

#### Scenario: 拒绝非法画布配置

- **WHEN** canvas 缺失、grid 数值非法、主线间隔不是正整数或 guide ID 重复
- **THEN** 校验返回稳定 issue code 和 canvas 字段 path
- **AND** 不返回经过静默修正的文档

### Requirement: 固定原点输出设置

ComposeDocument MUST 保存正有限 width/height 与合法 `backgroundPaint: ComposePaint` 的 output，并导出默认
`1280×720`、透明 Solid Paint 的 `createDefaultOutputSettings()`。输出原点 MUST 固定为世界 `(0,0)`；
`output.backgroundColor` MUST 在 v5 中被拒绝，系统不得提供双字段或自动迁移。

#### Scenario: 校验结构化输出背景

- **WHEN** 宿主创建默认输出，或提供含合法 Solid、Linear、Radial 或 Angular Paint 的自定义输出
- **THEN** 文档校验通过且值可 JSON 往返
- **AND** 非正、非有限尺寸、非法 Paint 或 `backgroundColor` 旧字段被拒绝

### Requirement: 版本化 ECS JSON 文档

ComposeDocument v6 LayoutItem width/height MUST 接受 `fixed | fill | hug`。Hug MUST 允许用于 Renderer
leaf 或拥有 Layout 的 Hierarchy Entity；缺少 Layout 的 free Hierarchy Entity MUST NOT 使用 Hug。

#### Scenario: 校验 Hug 内容来源
- **WHEN** Renderer leaf、root Auto Layout container 或嵌套 Auto Layout container 使用 Hug axis
- **THEN** 文档通过校验并保留 fallback value/min/max
- **AND** free Hierarchy Entity 的 Hug 被返回到精确 axis path 的 issue 拒绝

### Requirement: 统一 Entity 与 PascalCase Components

每个 ComposeEntity MUST 只保存稳定 id、name 和 JsonObject components。Component Key MUST 使用
PascalCase；系统 MUST 严格校验内建 Component，并保留未知合法 Component 的原始 JSON。

#### Scenario: 保存未知 Component

- **WHEN** Entity 包含当前宿主未注册但 Key 合法的 Component
- **THEN** Core 校验通过并原样保留其 JSON
- **AND** 运行时可用性留给 Registry 消费方处理

#### Scenario: 拒绝非法 Component Key

- **WHEN** components 包含 camelCase、全大写分隔符、空 Key 或非 JsonObject 值
- **THEN** 校验结果定位到对应 Component

### Requirement: Transform 与几何限制

Transform MUST 保存有限 position、正有限 size 和有限 rotation。TransformConstraints MAY 保存
movable、`free|preserve-aspect|horizontal|vertical|none` resize、rotatable、正有限 minSize 与
可选 maxSize；maxSize 不得小于 minSize。

#### Scenario: 保存独立几何限制

- **WHEN** Entity 设置水平 Resize、禁止旋转和有限尺寸区间
- **THEN** 文档校验通过并保持字段原值

#### Scenario: 拒绝非法尺寸限制

- **WHEN** Transform 或 TransformConstraints 包含非有限、非正、未知模式或逆向区间
- **THEN** 校验返回对应字段路径

### Requirement: ECS 层级拓扑

系统 MUST 使用隐式 Canvas 作为结构根，以 Hierarchy.childIds 表达唯一父子关系。每个 Entity
必须从 rootIds 恰好可达一次，不得存在缺失子项、重复父级、叶实体子项、孤儿或循环。

#### Scenario: 使用 Renderer 与 Hierarchy 组合树

- **WHEN** rootIds 包含纯 Renderer、纯 Container 和可渲染 Container
- **THEN** 文档校验通过并保留确定性场景顺序

#### Scenario: 拒绝非法 ECS 拓扑

- **WHEN** childIds 缺失、重复拥有父级、指向无 Hierarchy 的父级或形成循环
- **THEN** 校验器返回稳定 issue 和路径

### Requirement: Component 化外观和渲染数据

Appearance MUST 只保存背景、边框、圆角、透明度和结构化阴影；缺失时解析为透明默认值。
Renderer MUST 保存非空 type 与严格 JsonObject props，不得保存 React、Schema 或 factory。

#### Scenario: 解析明确或缺失 Appearance

- **WHEN** Entity 提供部分 Appearance 或完全省略 Appearance
- **THEN** 解析器分别合并给定值或返回透明默认外观
- **AND** 不依赖旧节点 kind

#### Scenario: 保存未知 Renderer

- **WHEN** Renderer.type 当前未注册但非空
- **THEN** Core 文档仍有效且 props 保持不变

### Requirement: 场景 Entity 最小组合

每个 Entity MUST 拥有合法 Composition、Transform、Visibility 与 Lock，并 MUST 至少拥有 Renderer
或 Hierarchy。Renderer 与 Hierarchy MAY 同时存在；Clip MUST 依赖 Hierarchy，
TransformConstraints MUST 依赖 Transform。

#### Scenario: 可渲染容器

- **WHEN** Entity 同时拥有 Renderer 和带子项的 Hierarchy
- **THEN** 文档校验通过并保留两个 Components

#### Scenario: 拒绝不完整组合

- **WHEN** Entity 缺失基础 Component、同时缺少 Renderer/Hierarchy 或拥有无 Hierarchy 的 Clip
- **THEN** 校验器返回稳定组合问题和 Component 路径

### Requirement: Composition 归属数据

Composition MUST 保存非空或 null presetId、唯一合法 baseComponentKeys 与唯一 capabilityIds。
baseComponentKeys MUST 指向 Entity 当前存在的 Components，Composition 自身 MUST 始终受保护。

#### Scenario: 保存 Preset 和能力归属

- **WHEN** Entity 由 Preset 创建并添加能力
- **THEN** Composition 保留基础 Component Keys 和能力 ID
- **AND** JSON 往返不依赖运行时 Registry

### Requirement: 图片背景 Paint

ComposeDocument MUST 允许 `backgroundPaint` 使用带稳定资源引用的 `image` Paint。图片 Paint MUST 保存显示模式、图片透明度和可选颜色叠加，且不得保存 Blob URL 或临时 File 数据。

#### Scenario: 保存图片背景

- **WHEN** 宿主为 Picker 提供一个可引用的图片资源
- **THEN** 文档保存其稳定引用和规范化图片设置
- **AND** 原有 Solid 与 Gradient Paint 继续有效

### Requirement: 页面文件约定

页面 MUST 以版本化聚合对象持久化为资源文件，包含 `kind: 'compose-page'`、`pageSchemaVersion: 1`、
一份合法 `ComposeDocument v6` 的 `document`，以及一个可空的 `setupScript` 稳定资源引用。页面身份 MUST
由 Asset Provider 上报的页面媒体类型判定，MUST NOT 由文件名判定。`core` MUST 导出媒体类型判定、
页面文件命名助手、文件名与显示名转换、聚合页面解析/序列化，以及把旧裸 ComposeDocument v6 转换为
新包装格式的显式单向迁移。正常运行与写入路径 MUST NOT 长期接受两种格式。

#### Scenario: 身份只由媒体类型决定

- **WHEN** 条目的媒体类型为页面媒体类型
- **THEN** 判定为页面，无论其文件名是否带页面后缀
- **AND** 媒体类型不是页面时判定为非页面，即使文件名带页面后缀

#### Scenario: 识别页面文件并取显示名

- **WHEN** 传入名称 `Home.page.json`
- **THEN** 判定为页面文件且显示名为 `Home`
- **AND** 由显示名 `Home` 反向生成的文件名等于 `Home.page.json`

#### Scenario: 拒绝非页面文件

- **WHEN** 传入名称 `Home.json` 或 `page.json.txt`
- **THEN** 判定为非页面文件
- **AND** 不产生副作用

#### Scenario: 解析非法页面内容

- **WHEN** 页面包装不是合法 JSON、pageSchemaVersion 不受支持、document 不是合法 v6，或 setupScript 引用形状非法
- **THEN** 解析返回描述原因和路径的 issue
- **AND** 不返回部分页面

#### Scenario: 显式迁移旧裸页面

- **WHEN** 宿主把合法的旧裸 ComposeDocument v6 传给页面迁移函数
- **THEN** 得到 document 为原文档且 setupScript 为 null 的新页面包装
- **AND** 普通页面解析器不会把旧裸格式静默当作新页面运行

#### Scenario: 创建空白页面文档

- **WHEN** 请求创建一份空白页面
- **THEN** 得到 pageSchemaVersion 为 1、setupScript 为 null 的页面包装
- **AND** 内部 document 为 rootIds 为空、带默认画布和输出设置的 ComposeDocument v6

### Requirement: 应用清单与首页指向

`core` MUST 定义资源根应用清单 `app.json`，其形状为 `{ schemaVersion: 1, homePageKey: string | null }`，
并 MUST 提供宽容解析与序列化。解析 MUST 在内容缺失、非法 JSON、结构不符或版本不支持时降级为
`homePageKey` 为 null 并返回可判别的 issue。序列化 MUST 原样写回解析时保留的未知顶层字段。
首页 MUST 由该清单唯一表达，页面文档自身 MUST NOT 携带首页标记。

#### Scenario: 清单缺失

- **WHEN** 资源根不存在 `app.json`
- **THEN** 解析结果的 `homePageKey` 为 null
- **AND** 不产生任何写入

#### Scenario: 清单损坏

- **WHEN** `app.json` 内容不是合法 JSON、结构不符或 `schemaVersion` 不受支持
- **THEN** 解析结果的 `homePageKey` 为 null 并附带对应 issue
- **AND** 既有文件内容不被覆盖

#### Scenario: 设首页保留宿主字段

- **WHEN** `app.json` 含有清单 Schema 之外的顶层字段，且首页被改写
- **THEN** 序列化结果包含新的 `homePageKey`
- **AND** 原有未知顶层字段被原样保留

### Requirement: 页面引用值与嵌套护栏

`core` MUST 定义页面引用值，其为可嵌入 `JsonObject` 的扁平字符串映射，包含 `kind` 为 `'page'`、
`providerId`、`assetKey` 与 `scope`。`core` MUST 提供从任意值读取页面引用的判别函数，以及基于
祖先页面链与深度上限判定嵌套状态的纯函数，结果 MUST 区分正常、循环引用与超出深度上限。

#### Scenario: 读取页面引用

- **WHEN** 传入含 `kind` 为 `'page'` 且字段完整的值
- **THEN** 返回该页面引用
- **AND** 传入 null、非对象或字段缺失的值时返回空结果

#### Scenario: 检出循环引用

- **WHEN** 待渲染页面的 key 已存在于祖先页面链中
- **THEN** 嵌套状态判定为循环引用

#### Scenario: 检出超出深度上限

- **WHEN** 当前嵌套深度已达到深度上限
- **THEN** 嵌套状态判定为超出深度上限
- **AND** 深度小于上限且无循环时判定为正常

### Requirement: 可选 Flex Layout Component

Layout MUST 只与 Hierarchy 组合，并保存明确的 Flex direction、wrap、alignContent、
justifyContent、alignItems、四边 padding、rowGap 与 columnGap。Flow LayoutItem MUST 仅位于直接拥有
Layout 的 parent 下；根级或 free parent 的子项 MUST 为 Absolute。

#### Scenario: 校验 Flow 与 Absolute 位置模式
- **WHEN** Layout parent 包含 Fixed Flow 与 Absolute 子项
- **THEN** 文档通过校验且 Hierarchy.childIds 决定 Flow 顺序
- **AND** 根级 Flow、free parent 下 Flow 或非法数值被拒绝

### Requirement: 显式 v5 到 v6 迁移

Core MUST 发布纯函数迁移器，先严格验证 v5，再返回经过 v6 validator 的新文档或可定位 issues。
迁移 MUST 不修改输入、保留未知合法 Component，并把所有既有子项转为 Absolute 以保持视觉。

#### Scenario: 迁移合法 v5 文档
- **WHEN** 宿主向迁移器传入带嵌套 Transform、Layout、constraints 和未知 Component 的合法 v5
- **THEN** 返回 rotation-only Transform、Fixed LayoutItem、GeometryConstraints 和 v6 Layout
- **AND** 原输入、世界视觉、Hierarchy 顺序与未知数据保持不变

### Requirement: Renderer Props 绑定 Component

ComposeDocument v6 MUST 支持可选内建 `Bindings` Component，其 `version` MUST 为 1，`rendererProps`
MUST 包含顶层 Prop 名称到引用的 `fields` 映射。引用 MUST 为
`{ scope: 'page', exportName: string }`。Bindings MUST 只保存严格 JSON 引用，不得保存脚本当前值、State、
Computed 或 Function。Core MUST 校验引用形状但 MUST NOT 依赖运行时 Registry 判断 Prop 是否存在；
字段均未绑定时 MUST 拒绝空 Component。

#### Scenario: 保存页面返回成员绑定

- **WHEN** 一个 Renderer Entity 把 `text` 与 `onClick` 分别绑定到页面返回成员 `num` 与 `onAdd`
- **THEN** 文档 JSON 往返后保留两个稳定引用
- **AND** 文档中不包含两个成员的当前值或函数对象

#### Scenario: 保留未知 Renderer Prop 绑定

- **WHEN** 文档包含当前 Registry 未声明的合法 Prop 名称或页面返回成员已经缺失
- **THEN** Core 继续保留合法 Bindings JSON
- **AND** 运行时消费方负责诊断和字面 fallback

#### Scenario: 拒绝非法 Bindings

- **WHEN** Bindings 出现在没有 Renderer 的 Entity，绑定集合为空，或 version、scope、Prop 名称、exportName 的形状非法
- **THEN** ComposeDocument 校验返回精确路径的稳定 issue
- **AND** 不返回部分有效文档

