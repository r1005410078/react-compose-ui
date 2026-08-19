# compose-document Specification

## Purpose
TBD - created by archiving change add-command-transaction-runtime. Update Purpose after archive.
## Requirements
### Requirement: 版本化 ECS JSON 文档

ComposeDocument v7 LayoutItem width/height MUST 接受 `fixed | fill | hug`。Hug MUST 允许用于
Renderer leaf 或拥有 Layout 的 Hierarchy Entity；缺少 Layout 的 free Hierarchy Entity MUST NOT
使用 Hug。拥有 `Frame` 的 Entity MUST NOT 使用 Hug——其尺寸由 `Frame.size` 唯一确定。

#### Scenario: 校验 Hug 内容来源
- **WHEN** Renderer leaf、Auto Layout container 或嵌套 Auto Layout container 使用 Hug axis
- **THEN** 文档通过校验并保留 fallback value/min/max
- **AND** free Hierarchy Entity 的 Hug 被返回到精确 axis path 的 issue 拒绝

#### Scenario: 拒绝 Frame 上的 Hug
- **WHEN** 拥有 `Frame` 的 Entity 在任一 axis 使用 Hug
- **THEN** 校验返回稳定 issue 并定位到该 axis path

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

系统 MUST 以 rootIds 中的 Frame 作为结构根，以 Hierarchy.childIds 表达唯一父子关系。每个 Entity
必须从 rootIds 恰好可达一次，不得存在缺失子项、重复父级、叶实体子项、孤儿或循环。系统 MUST NOT
保留任何隐式 Canvas 根概念。

#### Scenario: 使用 Renderer 与 Hierarchy 组合树

- **WHEN** 某个根 Frame 的子树包含纯 Renderer、纯 Container、可渲染 Container 与嵌套 Frame
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
TransformConstraints MUST 依赖 Transform，`Frame` MUST 依赖 Hierarchy，`Animations` MUST 依赖 `Frame`。

#### Scenario: 可渲染容器

- **WHEN** Entity 同时拥有 Renderer 和带子项的 Hierarchy
- **THEN** 文档校验通过并保留两个 Components

#### Scenario: 拒绝不完整组合

- **WHEN** Entity 缺失基础 Component、同时缺少 Renderer/Hierarchy、拥有无 Hierarchy 的 Clip，
  或拥有无 `Frame` 的 `Animations`
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

### Requirement: 可选 WidgetSwitcher Component

ComposeDocument v6 MUST 支持可选内建 Component `WidgetSwitcher`，字段只有 `activeIndex: number`。
它 MUST 只在同时拥有 `Hierarchy` 的 Entity 上具有意义，MUST NOT 成为任何 Entity 的必需 Component，
因此 MUST NOT 触发文档版本变更或迁移。

Core MUST 提供纯函数解析活动子项：读取时 MUST 把 `activeIndex` 钳制到 `[0, childIds.length - 1]`，
子项为空时 MUST 返回 `null`。删除或新增子项 MUST NOT 顺带改写 `activeIndex`——钳制只发生在读取侧。

Core MUST 提供纯函数派生「本次渲染应跳过的 Entity ID 集合」，覆盖文档中全部 switcher 的非活动直接
子项。该函数 MUST 是 Stage、Preview、嵌套文档 Runtime 与 SceneIndex 的唯一事实来源。非活动子项
MUST NOT 通过写入 `Visibility` 来隐藏，`Visibility` 保留表达用户的显式意图。

#### Scenario: 索引越界钳制

- **WHEN** `activeIndex` 为 5 而 switcher 只有 2 个子项
- **THEN** 活动子项解析返回最后一个子项
- **AND** 文档中的 `activeIndex` 保持为 5 不被改写

#### Scenario: 空 switcher

- **WHEN** switcher 的 `childIds` 为空
- **THEN** 活动子项解析返回 `null`
- **AND** 隐藏集合中不包含任何 Entity

#### Scenario: 只隐藏非活动直接子项

- **WHEN** 从含 switcher 的文档派生隐藏集合
- **THEN** 集合包含该 switcher 除活动子项外的全部直接子项
- **AND** 不包含活动子项、不包含非 switcher 容器的任何子项
- **AND** 不写入或读取任何 Entity 的 `Visibility`

#### Scenario: 预览覆盖优先于活动索引

- **WHEN** 派生隐藏集合时为某个 switcher 指定了预览子项
- **THEN** 该 switcher 只显示预览子项，其余直接子项进入隐藏集合
- **AND** 其他 switcher 仍按各自的 `activeIndex` 解析

### Requirement: 文档可选动画清单

`ComposeDocument` MUST 支持可选的 `animations` 顶层字段，作为该文档的动画清单。清单每条
MUST 只包含稳定 `id`、用户可见 `name`、有限正数 `durationMs` 与 `playbackMode`，
MUST NOT 包含任何轨道或关键帧数据——那些存放在被动画 Entity 的 `Animation` Component 上。
该字段是向后兼容的加法扩展：缺省时等价于空清单，`schemaVersion` MUST 保持 `6`，
MUST NOT 引入迁移。`@compose-ui/core` MUST 提供归一化读取入口，使调用方不必各自处理 `undefined`。

#### Scenario: 老文档不含动画清单

- **WHEN** 校验一份没有 `animations` 字段的 `schemaVersion: 6` 文档
- **THEN** 校验通过
- **AND** 归一化读取入口返回空清单

#### Scenario: 新文档在动画清单上通过校验

- **WHEN** 校验一份含合法 `animations` 清单的文档
- **THEN** 校验通过且 `schemaVersion` 仍为 `6`

#### Scenario: 清单形状非法

- **WHEN** `animations` 不是数组
- **THEN** 校验失败并返回 `animation.invalid`，问题路径指向 `animations`

#### Scenario: 清单条目 ID 重复

- **WHEN** 清单中两条动画的 `id` 相同
- **THEN** 校验失败并返回 `animation.duplicate-id`

#### Scenario: 清单条目时长非法

- **WHEN** 某条动画的 `durationMs` 为零、负数或非有限数
- **THEN** 校验失败并返回 `animation.invalid-duration`

### Requirement: 动画播放控制绑定

清单条目 MUST 支持可选的 `bindings`，声明整条动画的播放控制到页面 setup 导出的绑定。
第一阶段 MUST 支持 `playing` 与 `currentTime` 两个目标，引用格式 MUST 复用既有的
`ComposePageExportReference`。绑定属于**整条动画**而非任何单个 Entity，因此 MUST 挂在清单条目上。
本需求只约束数据形状与校验，运行时语义由 `scene-animation` 之外的变更定义。

#### Scenario: 缺省无绑定

- **WHEN** 清单条目没有 `bindings` 字段
- **THEN** 校验通过，该动画不受任何脚本导出驱动

#### Scenario: 合法的播放绑定

- **WHEN** 某条动画的 `bindings.playing` 是 `{ scope: 'page', exportName: 'isReady' }`
- **THEN** 校验通过

#### Scenario: 绑定引用形状非法

- **WHEN** `bindings.playing` 的 `scope` 不是 `page`，或 `exportName` 是空字符串
- **THEN** 校验失败并返回 `animation.invalid-binding`

### Requirement: Container 分轴溢出协议

系统 MUST 在 v6 `Clip` Component 中向后兼容地表达横向与纵向的 `visible`、`clip`、`scroll`
策略，并提供不依赖 React 或 DOM 的统一解析和原子配置命令。

#### Scenario: 读取旧 Clip 文档

- **WHEN** v6 Entity 的 Clip 只有 `enabled: true` 或 `enabled: false`
- **THEN** 系统分别将两个轴解析为 `clip` 或 `visible`

#### Scenario: 规范化混合滚动策略

- **WHEN** 一个轴配置为 `scroll` 且另一个轴请求 `visible`
- **THEN** 原子命令将另一个轴规范化为 `clip`

### Requirement: 可持久化编辑器画布设置

ComposeDocument v7 MUST 保存 grid 与 smartSnap。Grid stepX/stepY MUST 为有限正数，
offsetX/offsetY MUST 为有限数，primaryLineEvery MUST 为正整数。`canvas` MUST NOT 保存
guides——辅助线归属 Frame。`canvas` 是编辑器视口设置，MUST NOT 承载任何内容语义。

#### Scenario: 创建默认画布设置

- **WHEN** 宿主调用 `createDefaultCanvasSettings`
- **THEN** 得到 8×8、零偏移、每 8 格主线且三类吸附开启的独立 JSON
- **AND** 结果不包含 guides 字段且多次调用不共享可变对象

#### Scenario: 保存全局辅助线

- **WHEN** 文档需要保存辅助线
- **THEN** 辅助线 MUST 保存在所属 Frame 的 `Frame.guides` 上，位置以该 Frame 原点为参照
- **AND** `canvas.guides` 不再存在；带该字段的文档被拒绝而不是静默丢弃

#### Scenario: 拒绝非法画布配置

- **WHEN** canvas 缺失、grid 数值非法、主线间隔不是正整数，或 canvas 仍包含 guides 字段
- **THEN** 校验返回稳定 issue code 和 canvas 字段 path
- **AND** 不返回经过静默修正的文档

### Requirement: Frame Component 与隔离边界

系统 MUST 提供 PascalCase `Frame` Component。拥有 `Frame` 的 Entity MUST 同时拥有 `Hierarchy`。
`Frame` MUST 保存正有限 `size`，该 size MUST 是该 Entity 尺寸的唯一事实来源，并覆盖 `Transform.size`
与 LayoutItem 的推导结果。Frame MUST 构成六重隔离边界：子级 `LayoutItem.offset` 相对 Frame 局部原点；
Frame 拥有独立布局求解 Runtime；Frame 默认裁剪且可通过 `Clip` 关闭；动画时间轴、脚本作用域与
预览/导出单位均以 Frame 为界。Frame MUST 可嵌套于任意深度。

#### Scenario: 容器升格为 Frame

- **WHEN** 宿主向一个已有 `Hierarchy` 的 Container Entity 添加 `Frame` Component
- **THEN** 该 Entity 的 id、名称、子级与既有 Components 全部保持不变
- **AND** 文档校验通过且该 Entity 成为新的坐标、布局、裁剪、动画与脚本作用域边界

#### Scenario: 拒绝无 Hierarchy 的 Frame

- **WHEN** 一个只有 `Renderer` 的叶 Entity 声明 `Frame`
- **THEN** 校验返回稳定 issue，路径定位到该 Entity 的 `Frame` Component

#### Scenario: 子级偏移相对 Frame 局部原点

- **WHEN** 一个 Frame 位于父级坐标 `(400, 300)`，其子级 `LayoutItem.offset` 为 `(10, 10)`
- **THEN** 该子级的局部坐标为 `(10, 10)`，不受 Frame 自身位置影响
- **AND** Frame 位置变化不改写任何子级的 offset

### Requirement: 根层级 Frame 约束

`ComposeDocument.rootIds` MUST 至少包含一个 Entity，且其中每个 Entity MUST 拥有 `Frame`
Component。非 Frame Entity MUST NOT 出现在 rootIds。多个根 Frame MUST 保持确定性顺序，
并各自拥有独立的局部原点与隔离边界。

#### Scenario: 多画板文档

- **WHEN** 文档的 rootIds 包含三个尺寸不同的 Frame
- **THEN** 校验通过并保留 rootIds 顺序
- **AND** 每个 Frame 的子级只从该 Frame 可达一次

#### Scenario: 拒绝根层级的非 Frame Entity

- **WHEN** rootIds 直接包含一个 Rectangle 或普通 Container
- **THEN** 校验返回稳定 issue 并定位到该 root id
- **AND** 不返回经过静默包装修正的文档

### Requirement: Frame 局部辅助线

辅助线 MUST 保存在 Frame Entity 上并使用该 Frame 的局部坐标。guide ID MUST 在所属 Frame 内
非空且唯一，axis MUST 为 `x|y`，position MUST 为有限数。辅助线 MUST NOT 保存在
`ComposeDocument.canvas` 或任何世界坐标空间。

#### Scenario: 保存 Frame 局部辅助线

- **WHEN** Frame 包含位于其局部正负坐标的合法水平与垂直辅助线
- **THEN** 校验保留 guide 顺序、ID、axis 与 position
- **AND** 移动该 Frame 不改变任何 guide 的 position

#### Scenario: 拒绝重复 guide ID

- **WHEN** 同一 Frame 内两条 guide 使用相同 ID
- **THEN** 校验返回稳定 issue code 与该 Frame 的 guide 字段 path

### Requirement: Frame 动画清单 Component

动画清单 MUST 保存在 Frame Entity 的 PascalCase `Animations` Component 中，`ComposeDocument`
MUST NOT 保存文档级 `animations` 字段。清单条目 MUST 保存稳定 id、名称、正有限 `durationMs`
与播放模式。任意 Entity 的 `Animation` Component 中出现的动画分组 id MUST 存在于其所属 Frame
的 `Animations` 清单中。

#### Scenario: 组件 Frame 拥有自己的动画

- **WHEN** 一个作为组件根的 Frame 声明 `Animations` 清单，其后代 Entity 携带对应分组的轨道
- **THEN** 文档校验通过
- **AND** 该动画不出现在宿主 Frame 的清单中

#### Scenario: 拒绝孤立动画分组

- **WHEN** Entity 的 `Animation` Component 引用了所属 Frame 清单中不存在的分组 id
- **THEN** 校验返回稳定 issue 并定位到该 Entity 与分组 id

### Requirement: ComposeDocument v6 到 v7 显式迁移

系统 MUST 提供 v6→v7 的显式单向迁移入口。迁移 MUST NOT 修改输入，MUST 为纯函数且对同一输入
产生确定结果。迁移 MUST 新建唯一根 Frame，把 `output.width/height` 写入 `Frame.size`、
`output.backgroundPaint` 写入根 Frame 的 `Appearance.backgroundPaint`、原 rootIds 按原顺序
成为根 Frame 子级、`document.animations` 写入根 Frame 的 `Animations`、`canvas.guides` 恒等
迁移为根 Frame 局部辅助线。普通解析遇到 v6 文档 MUST 返回结构化 legacy issue 而非静默升级。

#### Scenario: 迁移完整 v6 文档

- **WHEN** 宿主对包含 output、多个根 Entity、animations 与 guides 的 v6 文档执行显式迁移
- **THEN** 得到通过 v7 校验的等价文档，根 Frame 尺寸与背景来自原 output，子级顺序保持不变
- **AND** 所有 Entity id、`Animation` 轨道与关键帧逐字节保持不变

#### Scenario: 拒绝隐式升级

- **WHEN** 普通解析入口收到 v6 文档
- **THEN** 返回稳定 legacy issue code
- **AND** 不返回任何已升级的文档

