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

### Requirement: Frame 升格纯函数入口

`@compose-ui/core` MUST 导出一个把既有 Entity 就地升格为 Frame 的纯函数。该函数 MUST 只添加
`Frame`——缺 `Hierarchy` 时补一个空 `Hierarchy`，把 `Hierarchy` 与 `Frame` 补进
`Composition.baseComponentKeys`，写入给定 `size`。Entity 的 id、名称、子级与其余全部
Component（含 `Appearance`、`Clip`、`Renderer`、动画轨道）MUST 原地保留，MUST NOT 被规范化
或重置。对已经拥有 `Frame` 的 Entity 调用 MUST 是幂等的（只更新 `size`）。所有隐含升格入口
MUST 复用它，MUST NOT 各自内联一份。

#### Scenario: 升格保留既有外观

- **WHEN** 对一个背景为 `#204020`、`Clip.enabled` 为 false 的 Container 调用升格
- **THEN** 结果 Entity 的 `Appearance` 与 `Clip` 与升格前逐字段相同
- **AND** 结果 Entity 拥有 `Frame` 且 `Composition.baseComponentKeys` 含 `Frame`

#### Scenario: 升格后 Frame 不可被移除

- **WHEN** 宿主对升格后的 Entity 派发 `entity.component.remove` 移除 `Frame`
- **THEN** 命令返回 `component.protected` 而不是产出一个根为非 Frame 的非法文档

#### Scenario: 对叶 Entity 升格补齐 Hierarchy

- **WHEN** 对一个只有 `Renderer` 的叶 Entity 调用升格
- **THEN** 结果同时获得空的 `Hierarchy` 与 `Frame`，满足 `Frame ⇒ Hierarchy` 不变量

### Requirement: 场景常见尺寸预设

`@compose-ui/core` MUST 导出一组只读的场景常见尺寸预设，作为编辑器各入口共用的唯一事实
来源。每个预设 MUST 具备稳定 id、正有限 `size`，以及可选的公认通名（如 `Full HD`）。
core MUST 同时导出按尺寸反查预设的纯函数，尺寸不匹配任何预设时返回 `null`。

预设列表 MUST 与既有 Frame Inspector 呈现的六个桌面分辨率一致：1280×720、1366×768、
1440×900、1920×1080、2560×1440、3840×2160。消费方 MUST NOT 各自复制该列表。

预设 MUST NOT 参与文档校验或迁移：它只是新建与改尺寸时的快捷入口，任何正有限尺寸都是
合法的 `Frame.size`。

#### Scenario: 反查匹配的预设

- **WHEN** 以 `{ width: 1920, height: 1080 }` 反查预设
- **THEN** 返回该预设，其通名为 `Full HD`

#### Scenario: 自定义尺寸没有匹配预设

- **WHEN** 以 `{ width: 1000, height: 800 }` 反查预设
- **THEN** 返回 `null`

#### Scenario: 预设不改变文档校验

- **WHEN** 一个 Frame 的 `size` 是 `{ width: 1000, height: 800 }`
- **THEN** 文档校验通过，尺寸不匹配预设不产生任何 issue

### Requirement: 几何数值精度约定

`@compose-ui/core` MUST 导出统一的几何数值精度约定：精度常量、把数值量化到该精度的纯函数，
以及把数值格式化为最多该位数小数的纯函数。所有可以依赖 core 的包 MUST 共用这一份事实来源，
MUST NOT 各自写一份四舍五入。

格式化 MUST 满足：整数不补零（`1280` → `"1280"`），小数最多保留约定位数且去掉尾随零
（`82.96874999999991` → `"82.97"`，`0.50` → `"0.5"`）。

架构上不允许依赖 core 的包（如 `property-panel`）MUST 在包内保留一份等价实现，并在实现处
说明该重复来自包边界而不是疏忽。

#### Scenario: 量化掉浮点残渣

- **WHEN** 对 `82.96874999999991` 调用量化函数
- **THEN** 返回 `82.97`

#### Scenario: 格式化不补零也不留尾随零

- **WHEN** 分别格式化 `1280`、`82.96874999999991` 与 `0.5`
- **THEN** 依次得到 `"1280"`、`"82.97"` 与 `"0.5"`

#### Scenario: 场景尺寸沿用同一精度

- **WHEN** 一块场景的 `Frame.size` 因历史数据带有小数
- **THEN** 场景尺寸文案按同一精度呈现，MUST NOT 出现长尾小数

### Requirement: 可选 Interaction Component

`core` MUST 定义可选的 `Interaction` Entity Component,用于声明该 Entity 在运行期的
trigger 与 action。它 MUST 可以与任意 Entity 组合,MUST NOT 要求 `Renderer`、`Hierarchy`
或任何其他 Component 同时存在。

`Interaction` 的形状 MUST 为 `{ version: 1, triggers: Trigger[] }`。每个 Trigger MUST 含
`event` 与 `action`。v1 MUST 只接受 `event` 为 `'click'`;`action` MUST 是可判别联合,v1
MUST 只接受 `{ type: 'navigate', target: PageReference | null, params?: JsonObject }` 与
`{ type: 'navigate-back' }`。`navigate` 的 `target` MUST 复用既有页面引用值,并 MUST 允许
为 `null` 表示"尚未选择目标"——属性面板新增一条交互时先产生一行,用户才能在这行里挑页面,
不允许 null 会让新建交互与选目标互为前提。**不完整**的引用(缺字段)MUST 仍然被拒绝:
那是配错了,与"还没配"是两回事。运行期 null 目标 MUST 是 no-op。
未知的 `event` 或 `action.type` MUST 在校验时被拒绝而不是静默丢弃。

`triggers` MUST 是数组且同一 `event` MUST NOT 出现多次。空数组 MUST 合法,语义等价于
没有 `Interaction`。`Interaction` MUST NOT 影响布局求解、几何或任何编辑期语义。
不含 `Interaction` 的既有文档 MUST 继续合法且行为不变。

#### Scenario: 任意 Entity 携带 Interaction

- **WHEN** 一个只有 Transform 与 Appearance 的 Entity 加上含 click→navigate 的 `Interaction`
- **THEN** 文档通过校验
- **AND** 该 Entity 的布局与几何求解结果与加上之前完全一致

#### Scenario: 拒绝未知 trigger 与 action

- **WHEN** 文档中的 `Interaction` 含 `event` 为 `'hover'` 或 `action.type` 为 `'open-url'`
- **THEN** 校验以可判别 issue 拒绝该文档
- **AND** 已有的合法 trigger 不被静默保留为部分结果

#### Scenario: 同一事件不重复声明

- **WHEN** `triggers` 中出现两个 `event` 均为 `'click'` 的条目
- **THEN** 校验拒绝该文档

#### Scenario: 目标尚未选择

- **WHEN** `Interaction` 含 `{ type: 'navigate', target: null }`
- **THEN** 文档通过校验
- **AND** 运行期点击该 Entity 不发生跳转

#### Scenario: 空 triggers 合法

- **WHEN** Entity 的 `Interaction.triggers` 为空数组
- **THEN** 文档通过校验且该 Entity 在运行期不接收任何交互

### Requirement: 导航端口协议

`core` MUST 定义导航端口协议 `ComposeNavigationPort`,作为文档运行时与页面导航实现之间
唯一的类型契约。它 MUST 只使用 `core` 已有的页面引用值与纯数据,MUST NOT 引用 React、
DOM 或 `@compose-ui/pages` 中的任何实现类型。

该端口 MUST 至少表达:当前页面 key、是否可返回、按页面引用跳转、返回上一页。跳转与返回
MUST 允许实现为异步。`core` MUST NOT 自带任何导航实现——与 `ComposePageDocumentLoader`
一致,类型在 `core`、实现在 `@compose-ui/pages`、消费在渲染入口。

#### Scenario: 在无 DOM 环境实现端口

- **WHEN** 在没有 React 与 DOM 的运行时中实现 `ComposeNavigationPort`
- **THEN** 实现只需要页面引用值与纯数据即可满足类型
- **AND** 不需要引入任何渲染包

#### Scenario: core 不提供导航实现

- **WHEN** 宿主只依赖 `@compose-ui/core`
- **THEN** 可以获得端口类型但得不到任何可直接使用的导航会话

### Requirement: 页面引用值

`core` MUST 定义页面引用值，其为可嵌入 `JsonObject` 的扁平字符串映射，包含 `kind` 为 `'page'`、
`providerId`、`assetKey` 与 `scope`。`core` MUST 提供从任意值读取页面引用的判别函数。

`core` MUST NOT 再提供基于祖先页面链与深度上限的嵌套状态判定——页面嵌套已被删除，组件
实例拥有自己的循环检测与深度上限，不复用这套函数。

#### Scenario: 读取页面引用

- **WHEN** 传入含 `kind` 为 `'page'` 且字段完整的值
- **THEN** 返回该页面引用
- **AND** 传入 null、非对象或字段缺失的值时返回空结果

#### Scenario: 跳转目标复用同一引用

- **WHEN** `Interaction` 的 navigate 目标写入页面引用
- **THEN** 该值与资源面板拖入产生的引用形状完全一致
- **AND** 页面重命名或移动后引用仍然有效

### Requirement: 曲线是带盒的普通 Entity

曲线 Entity MUST 保留全部五个必备 Component（Composition、Transform、LayoutItem、
Visibility、Lock），几何 MUST 住在可选的 `Curve` 内建 Component 上，几何点 MUST 使用
**几何空间**坐标。位置的事实来源 MUST 保持 `LayoutItem.offset`，形状的事实来源是 `Curve`，
而**几何空间的范围**是几何的派生（紧包围盒，退化轴钳到 1）。

盒 MUST NOT 再被要求等于紧包围盒：盒由 `LayoutItem` 与布局求解决定，几何按盒与紧包围盒的
比例呈现。创建与绘制路径 MAY 在写入几何的同一个事务里把盒设成紧包围盒，那是**初值**而不是
不变量。

`Curve` MUST 与 Renderer 组合，MUST NOT 与 Hierarchy 组合。`schemaVersion` MUST NOT 因
本能力改变；不含 `Curve` 的既有文档校验结果 MUST 保持不变。

`kind` MUST 支持 `line`、`arc` 与 `polyline`：

- `arc` 由圆心、半径、起始角与**带符号的扫掠角**表达。MUST NOT 另立整圆类型——整圆是扫掠为
  ±360 的弧，否则归一化、平移、距离、特征点、渲染与校验六条路径各要多一份实现。
  MUST NOT 用终止角代替扫掠角：单给终止角分不出 10° 的短弧与 350° 的长弧。
- `polyline` 由顶点序列与 `closed` 布尔表达。MUST NOT 另立矩形类型——矩形是四顶点的闭合
  多段线，它唯一多出来的「四角是直角」在用户拖动某个顶点之后就不再成立。`closed` MUST 是
  布尔而不是「首尾顶点重复」：重复表示法无法区分闭合三角形与回到起点的开放折线，而两者在
  框选与捕捉上给出不同候选。

弧的紧包围盒 MUST 把落在扫掠范围内的**象限点**一并纳入，MUST NOT 只用两个端点：90° 到 270°
的弧鼓出来的那一侧在端点之外，只用端点算会让弧被自己的盒裁掉一块，而这只在跨象限的弧上出现。

新增 `kind` MUST NOT 需要迁移：既有 `line` 文档 MUST 逐字段不变。

#### Scenario: 曲线 Entity 校验通过

- **WHEN** 校验一个带五个必备 Component、Renderer 与合法 `Curve` 的 Entity
- **THEN** 校验通过，`schemaVersion` 仍为 7

#### Scenario: 非法组合被拒绝

- **WHEN** 校验一个 `Curve` 与 Hierarchy 组合、或缺少 Renderer、或几何点非有限数的 Entity
- **THEN** 校验失败并给出稳定机器码

#### Scenario: 既有文档不受影响

- **WHEN** 校验一份不含 `Curve` 的既有 v7 文档
- **THEN** 校验结果与本能力引入前逐字一致

#### Scenario: 整圆表达为扫掠 360 的弧

- **WHEN** 创建一个整圆
- **THEN** 它是 `kind` 为 `arc`、扫掠绝对值为 360 的曲线

#### Scenario: 矩形表达为闭合多段线

- **WHEN** 创建一个矩形
- **THEN** 它是四个顶点、`closed` 为真的 `polyline`

#### Scenario: 跨象限的弧不被盒裁掉

- **WHEN** 归一化一段跨越某个象限点的弧
- **THEN** 几何空间的范围覆盖该象限点

#### Scenario: 既有直线几何逐字段不变

- **WHEN** 归一化一条既有的直线曲线
- **THEN** 结果与新增 kind 之前一致

#### Scenario: 盒与紧包围盒不等时几何不变

- **WHEN** 盒被改成紧包围盒的两倍宽
- **THEN** `Curve` 的几何数值一个都没变

### Requirement: 曲线几何经由单一写入漏斗

端点编辑 MUST 通过一条内建命令在同一事务里写入 `Curve` 并重算 `LayoutItem` 的尺寸与
offset，MUST NOT 存在绕开该命令直接写盒或几何的第二个入口。数值 MUST 经
`roundComposeGeometry` 量化。撤销一步 MUST 回到编辑前的几何与盒。

该命令 MUST 覆盖全部 `kind`：弧与多段线的几何写入 MUST 走同一条命令，MUST NOT 各自新开入口。

#### Scenario: 端点编辑同步盒

- **WHEN** 通过命令把线的一个端点移出当前盒
- **THEN** `Curve` 与 `LayoutItem` 在同一事务里更新，盒仍是几何的紧包围盒

#### Scenario: 退化轴不违反盒校验

- **WHEN** 把线编辑成水平线
- **THEN** 盒高钳为 1，文档校验通过，几何点保持精确值

#### Scenario: 撤销一步还原

- **WHEN** 端点编辑后撤销
- **THEN** 几何与盒同时回到编辑前

#### Scenario: 弧与多段线走同一条命令

- **WHEN** 写入一段弧或一条多段线的几何
- **THEN** 使用的是同一条曲线几何写入命令，盒同步为新的紧包围盒

### Requirement: 共享坐标语法

系统 MUST 支持三种键入坐标：绝对 `x,y`、相对上一点 `@dx,dy`、极坐标 `距离<角度`。
角度 MUST 以度为单位、逆时针为正；由于屏幕 Y 轴向下，实现 MUST 对 y 分量取负，使
`100<90` 指向屏幕上方。

相对与极坐标 MUST 在没有上一点时被拒绝；非法写法 MUST 被拒绝而不是求出一个近似点——
调用方据此转而按命令关键字处理。

#### Scenario: 三种写法

- **WHEN** 用户依次键入 `100,50`、`@10,20`、`100<45`
- **THEN** 第一种得到绝对点，第二种相对上一点偏移，第三种按距离与角度求解
- **AND** `100<90` 指向屏幕上方而不是下方

#### Scenario: 缺少上一点时拒绝相对写法

- **WHEN** 命令的第一步键入 `@10,20` 或 `100<45`
- **THEN** 输入被拒绝并给出可判别的失败原因

#### Scenario: 非法写法被拒绝

- **WHEN** 键入的文本不是任何一种坐标写法
- **THEN** 解析失败且不产生任何近似点

### Requirement: Transform 承载可选的旋转基点

`Transform` Component MUST 支持可选的 `pivot` 字段，取值为**归一化盒坐标**的二维点。
缺席 MUST 等价于盒中心 `{ x: 0.5, y: 0.5 }`。

`pivot` MUST NOT 被钳制到 `[0, 1]`：基点落在盒外表达「绕一个外部支点摆动」，是正当用法。
坐标 MUST 是有限数字，`pivot` 自身 MUST 是二维点，未知字段 MUST 拒绝——写错名字的基点会
静默退回中心，用户只看到「基点没生效」。

协议版本 MUST NOT 因本字段变化，且 MUST NOT 需要迁移——没设过基点的文档在渲染与几何求解上
MUST 与本变更之前完全一致。

#### Scenario: 缺席时等价于盒中心

- **WHEN** 一个 Entity 的 `Transform` 没有 `pivot`
- **THEN** 它的旋转绕盒中心，与本变更之前的结果一致

#### Scenario: 基点可以落在盒外

- **WHEN** 设置一个坐标分量大于 1 的基点
- **THEN** 文档校验通过

#### Scenario: 坐标不是数字时非法

- **WHEN** 基点的某个坐标分量不是数字
- **THEN** 文档校验失败并给出 `transform.invalid`

#### Scenario: 未知字段被拒绝

- **WHEN** 基点带有 `x` / `y` 之外的字段
- **THEN** 文档校验失败

### Requirement: 盒与几何之间只有一个换算入口

系统 MUST 提供盒 → 几何空间的变换与它的逆，并且 MUST 是**唯一**的换算入口：渲染、命中、
捕捉与几何写入四处 MUST 消费同一份。各自算一遍会让下一个改盒语义的人只改到其中一处，而
漏掉的那处症状是「某些缩放下点不中」——本仓库反复踩到的那一类。

变换 MUST 按轴独立，MUST NOT 只取一个标量：盒可以被非等比地拉伸，强行取单一比例会画出一个
用户从未画过的形状。

几何空间的退化轴 MUST 钳到与 `LayoutItem` 尺寸相同的最小值：水平线的紧包围盒高度是 0，
直接拿来做分母会得到除零，而两处取不同的钳值会让水平线被拉伸一个说不清的比例。

**等比判定的容差 MUST 由盒尺寸的量化步长推出**（`±步长/2 ÷ 取景框边长`，两轴相加），
MUST NOT 取一个与量化无关的绝对小量：盒尺寸写进文档时被舍到几何精度而几何本身不舍，因此两轴
比例天生就只知道到这个精度。取绝对小量的症状是**每一条画出来的弧都被判成非等比**——它在命中、
捕捉与几何编辑里全都退化成一串顶点的多段线，而渲染仍按 `viewBox` 画着真正的弧。

#### Scenario: 写进文档的弧仍判成等比

- **WHEN** 一条弧经归一化写进文档（盒尺寸按几何精度量化），再按这个盒求变换
- **THEN** 它仍被判成等比，投影结果仍是弧

#### Scenario: 容差不吞掉真实拉伸

- **WHEN** 同一条弧的盒被横向拉宽 1%
- **THEN** 它被判成非等比，投影结果是多段线

#### Scenario: 非等比盒给出两个不同的轴比例

- **WHEN** 盒的宽是紧包围盒的两倍、高与它相等
- **THEN** 变换在 x 轴的比例是 2，在 y 轴是 1

#### Scenario: 退化轴不除零

- **WHEN** 对一条水平线求变换
- **THEN** y 轴比例是有限数，且钳值与 `LayoutItem` 尺寸用的是同一个常量

#### Scenario: 变换与逆变换互为反函数

- **WHEN** 把一个点变换到几何空间再变换回来
- **THEN** 得到原点（在几何精度内）

### Requirement: 点在曲线内部的判定

`core` MUST 提供「一个点是否落在曲线几何内部」的判定，作为**唯一**入口供命中路径调用。
判定 MUST 把几何拍平成顶点序列后按奇偶规则求解，弧 MUST 复用既有的弧拍平函数——第二份弧
数学正是「一半改了另一半没改」的温床。

判定 MUST NOT 前置检查 `closed`：开放几何按**隐式闭合**处理，与 SVG 填充开放几何的规则相同，
渲染与命中因此自动一致，不需要在两处各写一遍「什么算封闭」。

判定的输入 MUST 是已经投影进盒坐标系的几何，MUST NOT 自己再做一次盒到几何的换算——那个换算
只有一个入口。

#### Scenario: 闭合多段线内部

- **WHEN** 判定一个点是否落在闭合四顶点多段线内部
- **THEN** 内部的点为真，外部的点为假

#### Scenario: 整圆内部

- **WHEN** 判定圆心是否落在扫掠 360 的弧内部
- **THEN** 为真

#### Scenario: 开放几何按隐式闭合

- **WHEN** 判定一个点是否落在开放三顶点多段线的首尾连线围出的区域内
- **THEN** 为真，与 SVG 填充该多段线时画出的区域一致

#### Scenario: 直线没有内部

- **WHEN** 判定任意点是否落在两点直线内部
- **THEN** 为假

### Requirement: 可选 Ports Component

文档协议 MUST 支持可选的 `Ports` Entity Component，声明这个 Entity 身上可以接线的点。
`items` 是 `{ id, position }` 的列表，`position` MUST 是 **Entity 局部坐标**（盒左上角为原点），
与 `Curve` 的盒局部几何同一个空间。

`Ports` MUST 能挂在**任意** Entity 上，MUST NOT 绑定到某一种物料或组件实例——端口是 Entity
的能力，与 `Interaction` 是同一条判断：画一个矩形给它两个端口，与放一个组件实例，在捕捉、
校验与导线求解眼里必须是同一件事。

同一个 Entity 内端口 id MUST 唯一。id 稳定是导线绑定不断的前提，重复 id 会让绑定指向「其中
一个」，而运行期没有正确答案。位置 MUST 是有限数。

`items` 为空的 `Ports` MUST 判为非法：一个不带任何端口的端口声明读不出意图。不再需要端口时
MUST 删掉整个 Component，与曲线外观「三项全清就整个删掉」是同一条判断。

`Ports` 缺席时文档行为 MUST 与今天完全一致，协议版本 MUST NOT 变化。

#### Scenario: 任意 Entity 都能带端口

- **WHEN** 一个矩形 Entity 声明两个端口
- **THEN** 文档校验通过，端口位置按该 Entity 的局部坐标解释

#### Scenario: 重复端口 id 非法

- **WHEN** 同一个 Entity 的两个端口用同一个 id
- **THEN** 校验产出可判别的问题码

#### Scenario: 空端口列表非法

- **WHEN** 一个 Entity 带 `Ports` 但 `items` 为空
- **THEN** 校验产出可判别的问题码

#### Scenario: 缺席即今天

- **WHEN** 文档中没有任何 `Ports`
- **THEN** 校验、渲染与命中与引入该 Component 之前逐字相同

### Requirement: 组件实例的端口从离线快照读出

读取一个 Entity 对外提供的端口 MUST 只有一个入口，它 MUST 合并两个来源：Entity 自己声明的
`Ports`，以及组件实例从 `resolvedSnapshot` 里带出来的**组件根 Frame** 的 `Ports`。实例自己
声明的端口 MUST 压过组件根的——那是作者在这一个实例上的显式覆盖。

组件根的端口 MUST NOT 被复制到实例 Entity 上。复制要在创建实例与**每一次刷新快照**的地方各
写一遍，漏一处的症状是「端口停在符号搬走之前的位置」，看起来像捕捉坏了而不是同步坏了。
读取入口住在本包，因此捕捉一侧不需要认识组件协议——「命中与捕捉路径读的字段必须是文档级
契约」这条边界由**入口的归属**满足，而不是由复制满足。

快照形状不合法时 MUST 当作没有端口，MUST NOT 抛出：快照由宿主写入，端口读取不是校验它的地方。

组件根上声明一次，全部实例 MUST 都有；变体覆盖端口 MUST NOT 需要任何新机制——端口是根 Frame
上一个 Component 的字段，既有的 `set-field` 覆盖它本来就合法。

#### Scenario: 实例带出组件根的端口

- **WHEN** 组件根 Frame 声明两个端口，页面上放置该组件的实例
- **THEN** 从实例 Entity 读出的端口就是这两个

#### Scenario: 实例自己声明的端口优先

- **WHEN** 实例 Entity 自己也带 `Ports`
- **THEN** 读出的是实例自己声明的那一份

#### Scenario: 快照不合法时当作没有端口

- **WHEN** 实例的 `resolvedSnapshot` 不是预期形状
- **THEN** 读出空列表，不抛出

### Requirement: 可选 Wire Component

文档协议 MUST 支持可选的 `Wire` Entity Component，记录这条曲线的两端**各绑到了哪个端口**：
每一端是 `{ entityId, portId }` 或缺席，缺席即自由端。

**两端指的是几何的首尾两个顶点**：两点直线是 `start` 与 `end`，多段线是首顶点与末顶点。
中间的拐点 MUST NOT 参与绑定——`Wire` 回答的问题是「这一端接到了哪个端口」，而拐点不接任何
东西，它是走线的形状而不是连接关系。

自由端 MUST NOT 存坐标：`Curve` 就是那个点。存第二份等于给同一个端点造两个事实来源，而两者
迟早分叉。

`Wire` MUST 与 `Curve` 组合——没有几何的导线画不出来，也没有自由端可言。几何 MUST 是 `line`
或 `polyline`；**弧 MUST 判为非法**：`Wire` 回答的是「这一端接到了哪个端口」，而弧没有首尾
顶点可言（它由圆心、半径与扫掠角定义）。

**绑定不完整**（缺 `entityId` 或 `portId`）MUST 判为文档非法：那是配错了。而**指向不存在的
实体或端口** MUST NOT 判为非法——那是解算失败，与实例动画「指向不存在的 id 时保留原值并在
Inspector 标为失效」是同一条判断。「还没配」「配错了」与「配的东西没了」必须可区分。

导线与它绑定的实体 MUST 同父级，违反 MUST 给出可判别的问题码。端口的父级坐标要按实例的盒与
旋转基点换算，跨层级还要合成整条祖先链的变换；限制在同一父级把「嵌套时静默错位」变成一条读
得出来的问题，而符号与导线本来就摆在同一块场景里。

`Wire` 缺席时文档行为 MUST 与今天完全一致，协议版本 MUST NOT 变化。

#### Scenario: 一端绑定一端自由

- **WHEN** 一条曲线的 `Wire` 只声明了 `start`
- **THEN** 校验通过，`end` 按 `Curve` 自己的几何解释

#### Scenario: 多段线导线的两端是首尾顶点

- **WHEN** 一条带四个顶点的多段线导线两端各绑到一个端口
- **THEN** 绑定描述的是首顶点与末顶点，中间两个拐点不参与绑定

#### Scenario: 弧不能是导线

- **WHEN** 一个 Entity 同时带 `Wire` 与 `kind` 为 `arc` 的 `Curve`
- **THEN** 校验产出可判别的问题码

#### Scenario: 绑定不完整非法

- **WHEN** 某一端只给了 `entityId` 而没有 `portId`
- **THEN** 校验产出可判别的问题码

#### Scenario: 指向已删除的实体不非法

- **WHEN** 被绑定的实体已从文档中删除
- **THEN** 文档仍然合法，解算时该端回退到作者几何

#### Scenario: 跨父级绑定给出问题码

- **WHEN** 导线与它绑定的实体不在同一个父级下
- **THEN** 校验产出可判别的问题码

### Requirement: 导线几何求解不存储

系统 MUST 提供纯函数把导线的绑定端解算成几何：输入是文档与布局快照，输出是把绑定端写进导线
`Curve` 与盒之后的文档。作者文档里导线的几何 MUST 被当作**会过期的缓存**，读取一方 MUST 读
解算后的那份。

求解 MUST 支持 `line` 与 `polyline` 两种几何。多段线时 MUST **只写首顶点与末顶点**，其余顶点
MUST 原样保留。

**MUST NOT 为「保持正交」补偿相邻顶点**，尽管绑定端移动之后原本水平的那一段会变斜。两个各自
独立的理由：一条导线**两端都可能绑定**，两端各自要求「保持我这一段正交」时中间顶点该听谁的
没有答案，而两端同时被移动（框选一片符号一起挪）恰恰是最常见的操作；以及任何「保持正交」的
规则都是**自动路由的一半**，半条规则产出的形状用户预测不了，比一条明显变斜的线更难修。

MUST NOT 在每一条改变实例位置的路径上回写导线几何。移动、方向键微调、Inspector 改位置、撤销、
粘贴、导入与组件刷新都会改变端口的世界位置，逐条挂钩子**漏一条的症状是「线错位」**——看起来
像渲染缺陷而不是数据缺陷，因此最难定位。这与块实例几何求解不存储是同一条原则。

端口的父级坐标 MUST 按**布局快照里的盒**换算，MUST NOT 按 `LayoutItem` 的尺寸值——实例的
`LayoutItem` 是 Hug，那个值只是测量缺席时的兜底。旋转 MUST 绕该 Entity 自己的旋转基点。

任一端解算失败（实体不存在、不是带端口的实体、端口 id 不存在）时，该端 MUST 保留作者文档里的
几何，MUST NOT 塌到原点或让整条导线消失。

#### Scenario: 移动符号，导线跟着走

- **WHEN** 把一个带端口的实体移动一段距离后重新解算
- **THEN** 导线绑定端落在端口的新位置上，自由端不动

#### Scenario: 多段线只动被绑的那一端

- **WHEN** 移动一条四顶点多段线导线起点所绑的符号后重新解算
- **THEN** 首顶点落在端口的新位置上，中间两个拐点与末顶点一个都不动

#### Scenario: 旋转符号，导线跟着转

- **WHEN** 给该实体一个非零旋转后重新解算
- **THEN** 绑定端落在绕该实体旋转基点转过之后的端口位置上

#### Scenario: 解算失败保留作者几何

- **WHEN** 绑定指向的端口 id 不存在
- **THEN** 该端保留作者文档里的坐标，导线照常渲染

### Requirement: 曲线拾取容差是跨包共享常量

`core` MUST 导出 `COMPOSE_CURVE_PICK_TOLERANCE`：点到曲线几何的拾取容差，单位是**屏幕 CSS
像素**，值为 AutoCAD `PICKBOX` 的默认值 3。

它 MUST 住在 `core`，MUST NOT 由各消费者各写一份：读它的是 `materials`（命中层的 stroke
宽度）与 `stage`（点选那一档拾取框的默认半边长），而这两个包之间没有依赖关系。这与
`COMPOSE_SCENE_SIZE_PRESETS` 是同一条判断——各写一份必然漂移，而这里漂移的症状（画出来的框
与真实容差对不上）正是引入本常量要消除的。

值 MUST 保持是抄来的而不是推来的：容差的对错只能在真实密度的图纸上判断，而这个默认值是几十年
密集图纸用出来的。同一个仓库里已有反例——十字线臂长曾按比例推导，推出的值在实机上明显偏长，
最终仍回到 `CURSORSIZE` 的默认值。

`core` MUST NOT 因此认识 DOM 或缩放：常量只是一个数，屏幕像素到世界单位的换算留在各消费者。

#### Scenario: 两个消费者读同一个数

- **WHEN** 检查曲线命中层的宽度与 Stage 点选拾取框的默认半边长
- **THEN** 两者都由 `COMPOSE_CURVE_PICK_TOLERANCE` 推出，仓库中没有第二处字面量

### Requirement: 曲线与矩形的相交判定住在 core

`core` MUST 在 `curve-geometry.ts` 提供曲线与轴对齐矩形的相交判定，供框选按几何而不是按包围盒
判定命中。它 MUST 与既有平面形状运算同模块——把其中几个函数挪到用得最多的那个包，会让弧的
数学横跨两个包，而那正是「一半改了另一半没改」的温床。

判定 MUST 按 `kind` 归约成线段：`line` 一段，`polyline` 走既有的 `composePolylineSegments`，
`arc` 走既有的 `flattenComposeArc`。弧拍扁的弦高误差 MUST 视为可接受——同一条选择已经在非等比
缩放的渲染上做过，而框选产出的是「选中或不选中」的布尔判断，误差不以任何方式呈现给用户。

判定 MUST 在与矩形同一个坐标空间内进行，MUST NOT 把矩形逆变换进几何空间：非等比缩放会把矩形
变成平行四边形，四条边不再轴对齐。

#### Scenario: 框与线段相交

- **WHEN** 判定一个与线段相交的矩形
- **THEN** 判定为相交

#### Scenario: 框只覆盖包围盒空角

- **WHEN** 判定一个落在斜线包围盒空角内、不与线身相交的矩形
- **THEN** 判定为不相交

#### Scenario: 框完全包住几何

- **WHEN** 判定一个完全包住整条曲线的矩形
- **THEN** 判定为相交

### Requirement: 取点数值字段的正反算

`@compose-ui/core` MUST 提供落点与数值字段之间的换算，且 MUST 是点输入管线的一部分——
键入与指针取点共用它，分叉的症状是「键盘打的和鼠标画的落点不一样」。

五种参数化：

- `absolute`：两个字段是 X、Y，带符号，不需要原点。
- `polar`：第一个字段是到原点的距离（非负），第二个是角度（度，逆时针为正，屏幕 Y 轴向下
  因此取负），与 `距离<角度` 的坐标写法**同一套约定**。
- `cartesian`：两个字段是相对原点的宽与高，**显示为量值**。屏幕上出现 `-440` 会让用户以为
  自己画错了，而矩形的自然量纲就是两条边长。
- `radius`：数学与 `polar` **逐字相同**，差别只在呈现只暴露第一个字段。半径就是极坐标的
  第一个分量，共用同一份数学让「裸数字 = 活动字段的值」在圆上不需要任何特判。
- `diameter`：第一个字段是 `polar` 距离的**两倍**，第二个字段与 `polar` 相同。

`radius` 与 `diameter` MUST 是**字段种类**而 MUST NOT 由命令层做一次乘二。直径要把被量的
那一段从「原点 → 落点」换成「对径点 → 落点」，而那是呈现层按种类分派的事；命令层乘二的话
呈现层无从得知自己该画哪一段。

MUST 另外提供「把某一个字段替换成键入值、另一个保持不变」的操作。它是锁定、直接距离输入与
「正在键入时预览跟着键入的值走」共用的那一步：裸数字缺的是**方向**，而方向正是另一个分量
此刻的值。

`cartesian` 的覆盖 MUST 沿用当前落点在那一轴上的符号；落在轴上（该分量为 0）时取正。
这是本模块唯一一处「显示值不等于内部值」，MUST 在实现旁写明。

角度覆盖 MUST 保持距离不变，距离覆盖 MUST 保持角度不变。覆盖 `diameter` 的第一个字段
MUST 保持角度不变，落点落在该方向上距离为键入值一半处。

#### Scenario: 极坐标正反算互逆

- **WHEN** 以某个原点把一个落点算成距离与角度，再用这两个值算回落点
- **THEN** 得到的落点与原落点一致

#### Scenario: 覆盖距离时角度不动

- **WHEN** 落点在原点的 30° 方向、距离 100，把距离覆盖成 260
- **THEN** 新落点仍在 30° 方向，距离为 260

#### Scenario: 宽高显示为量值但沿用符号

- **WHEN** 落点在原点的左上方 200 × 150
- **THEN** 两个字段读作 200 与 150
- **WHEN** 把宽覆盖成 300
- **THEN** 新落点在原点**左侧** 300，高不变

#### Scenario: 直径读数是半径的两倍

- **WHEN** 落点在原点的 30° 方向、距离 150
- **THEN** `radius` 的第一个字段读作 150，`diameter` 的读作 300

#### Scenario: 覆盖直径时方向不变

- **WHEN** 落点在原点的 30° 方向，把 `diameter` 的第一个字段覆盖成 300
- **THEN** 新落点仍在 30° 方向，距离为 150

### Requirement: 场景默认外观独立于容器

`@compose-ui/core` MUST 导出场景默认外观常量，其背景 MUST 是透明的：场景背景是会被发布出去
的真实像素而不是编辑器配色，编辑器 MUST NOT 替用户先填一个他迟早要改的颜色。该常量的背景
MUST NOT 与 `basic-materials` 的 Container Preset 默认外观绑定——两者相同曾经是一条不变量，
理由是「用户会看到画容器和画场景颜色不一样」，而那正是需要看出来的区别。需求改名正是为了
记下这次反转：旧名下的「新建场景与新建容器同底色」场景已经不成立，随旧名一并作废。

该常量的边框宽度 MUST 为 0：布局求解把边框计入内容盒，而场景是绝对坐标的原点，默认边框会
把每个直接子级整体推离网格。场景边界的可辨认性 MUST 由 Stage 的编辑器边界描边承担，MUST NOT
由默认背景色或默认边框承担——默认值只保护第一次，用户改过背景之后边界必须仍然读得出来。

Frame Entity 构造入口 MUST 默认采用该外观，并 MUST 提供显式覆盖参数，供 Preset 校验探针
这类非场景用途传回透明外观。

既有文档 MUST NOT 因本默认值变化而迁移：默认值只作用于新建，已有场景保留自己写下的背景。

#### Scenario: 新建场景背景透明

- **WHEN** 构造一个默认 Frame Entity
- **THEN** 它的 `Appearance.backgroundPaint` 是透明 solid Paint
- **AND** 该值不随 Container Preset 默认背景的变化而变化

#### Scenario: 场景默认不带边框

- **WHEN** 用户把一个子级按网格吸附拖到默认场景中
- **THEN** 属性面板里的位置坐标落在网格倍数上，而不是被场景边框推离 1 个单位

#### Scenario: 校验探针不继承场景外观

- **WHEN** Registry 构造用于 Preset 校验的探针 Frame
- **THEN** 该探针 Frame 的外观是显式传入的透明外观，而不是场景默认外观

#### Scenario: 既有场景背景不被改写

- **WHEN** 打开一份在本变更之前保存、场景背景为深色的页面文件
- **THEN** 该场景仍然是它保存时的深色背景，没有产生任何迁移事务

### Requirement: 共享点输入管线与角度约束

系统 MUST 在 `core` 提供「用户指定的一个点」的求解管线。管线 MUST 是纯函数，不认识任何文档
协议——它回答的是「这一次点击或这一次键入落在哪里」，与落点之后写进什么文档无关。指针取点与
键入坐标 MUST 走同一条管线：分叉的症状是「键盘画的和鼠标画的落点不一样」，而用户无法判断
哪个才对。

管线 MUST 遵守以下优先级：**显式键入的坐标 > 对象捕捉 > 网格吸附 > 角度约束**。显式键入的
坐标 MUST NOT 被任何吸附改写——用户键入 `100,50` 却落在 `96,48` 看起来像浮点误差、实际是
流程错误，是这类工具里最难排查的一类缺陷。

对象捕捉命中时 MUST 直接采用该特征点，MUST NOT 再经过网格与角度约束——捕捉到端点之后又被
挪走，等于捕捉没有发生。

**角度约束 MUST 是最后一步，排在网格之后。** 理由与上一条逐字相同：网格把刚约束到射线上的
点挪走，等于约束没发生。沿射线的位置因此是网格点在射线上的**投影**——斜射线上不落在格点上，
这是对的，那个方向上本来就没有格点。

角度约束有**三态，互相排斥**：

| 态 | 行为 |
| --- | --- |
| 关 | 不投影 |
| 正交 | **无条件**把点钳到相对上一点的水平或竖直方向（取位移较大的那个轴） |
| 极轴 | 按**增量角**成族生成射线，**只有**落点到最近射线的距离在容差内时才投影 |

三者 MUST 互斥：它们回答的是同一个问题——这一步的方向怎么被约束。做成两个独立布尔会造出
一个「都开」的第四态，而那一态没有正确答案。

**正交与极轴的差别只有一处：正交无条件投影，极轴只在容差内投影。** 这一处差别决定了各自的
默认值——正交默认必须关（否则画不了斜线），极轴默认可以开（它不挡任何画法）。

极轴的命中判据 MUST 是落点到射线的**距离**而 MUST NOT 是角度差。角度容差在远处会失控：离
参考点 500 单位时 ±3° 就是 ±26 单位的捕捉带，用户想画 87° 会被拽到 90°。距离容差恒定，远处
反而更精确，而近处所有射线本来就几乎重合。

管线 MUST 上报角度约束命中了哪条射线（或没有命中），呈现层据此画追踪射线；两处 MUST 读同
一份答案，各判一次的症状是「画了射线但点没落在上面」。

没有上一个点时（每条命令的第一步）角度约束 MUST 不生效——没有参考点就没有方向可言。

#### Scenario: 键入坐标不被吸附改写

- **WHEN** 网格与角度约束都开启且用户键入一个不落在网格上的绝对坐标
- **THEN** 结果就是键入的坐标

#### Scenario: 捕捉命中后不再经过网格与角度约束

- **WHEN** 取点时对象捕捉命中一个特征点且网格与极轴都开启
- **THEN** 结果就是该特征点

#### Scenario: 极轴在容差内才吸

- **WHEN** 增量角 45°、落点方向偏离 45° 射线的距离小于容差
- **THEN** 落点被投影到 45° 射线上
- **WHEN** 落点离每一条射线都超出容差
- **THEN** 落点不被投影，方向完全自由

#### Scenario: 正交无条件投影

- **WHEN** 正交开启且落点在相对上一点 30° 的方向上
- **THEN** 落点被钳到水平方向，与它离水平有多远无关

#### Scenario: 角度约束排在网格之后

- **WHEN** 参考点**不在**格点上，正交与网格都开启
- **THEN** 落点仍然与参考点严格共线——被钉死的那个分量 MUST NOT 再被网格取整

#### Scenario: 第一步没有角度约束

- **WHEN** 一条命令还在等第一个点、极轴开启
- **THEN** 落点不被任何射线投影

### Requirement: 多段线的四角联动圆角

`ComposePolylineCurve` MUST 接受一个可选的 `cornerRadius`，单位是几何空间。**缺席即尖角**，
因此既有文档逐像素不变——本字段 MUST NOT 触发迁移，协议版本 MUST NOT 变。

在场时 MUST 是有限正数；**0 MUST 被拒绝**：缺席与 0 是同一件事，留两种表示会让「有没有
圆角」在两处读出不同答案。半径归零的写入方 MUST 删掉这个字段而不是写 0。

**一个值管所有角**，MUST NOT 每个顶点一个：顶点类型因此保持 `{x, y}`，归一化、平移、DXF
导入与已经画好的每一条折线都一个字节不改。每角独立是本字段向后兼容的一次扩展。

哪些顶点算「角」MUST 由同一处判定：闭合折线的每个顶点都是角（收尾那一段与其余的段没有区别），
开放折线的首尾顶点不是（只有一条相邻边），共线与折回两种退化也不是。

每个角实际画出来的半径 MUST **在读取时钳制**——切线长不超过相邻两段各自长度的一半，因此同一
条边上的两个角永远不会互相吃掉那一段。钳制结果 MUST NOT 回写文档：这个数是作者的意图，此刻
画多大由当前几何决定。盒被拉窄时圆角自动收，拉回去原样回来。

一条圆角多段线 MUST 归约成**一列有序的轮廓片段**（缩短的直段与角弧交替），命中、框选、内部
判定与渲染 MUST 读这同一列。各自按 `cornerRadius` 再算一遍是禁止的——下一个改圆角数学的人
只会改到其中一处，而漏掉的那处的症状是「看得见的形状与点得中的形状不是同一个」。

紧包围盒 MUST 仍由**顶点**决定而不由圆角后的轮廓决定。对矩形两者恰好相等（角弧与边相切）；
锐角上圆角后的轮廓略小于顶点包围盒，这个偏差换来的是「拖圆角时盒一动不动」。

#### Scenario: 缺席时与尖角逐段相同

- **WHEN** 一条闭合四顶点多段线没有 `cornerRadius`
- **THEN** 它归约出来的线段与今天完全一致，没有任何弧

#### Scenario: 四个角各出一段弧

- **WHEN** 一个 200 × 100 的闭合矩形带 `cornerRadius` 20
- **THEN** 轮廓里有四段弧，四条直段各自按切点缩短

#### Scenario: 半径按相邻边钳制且不回写

- **WHEN** 同一个矩形的 `cornerRadius` 是 999
- **THEN** 四段弧的半径都是 50（短边的一半），而文档里的 `cornerRadius` 仍然是 999

#### Scenario: 圆角削掉的那一块不再算作内部

- **WHEN** 取左上角内侧一个点，先按尖角、再按半径 40 判定它在不在内部
- **THEN** 尖角时在内部，圆角后不在

#### Scenario: 共线与端点不圆

- **WHEN** 一条开放折线带 `cornerRadius`，其中一个顶点与两个邻居共线
- **THEN** 只有真正成角的那些顶点出弧，首尾顶点与共线顶点都不出

#### Scenario: 0 被拒绝

- **WHEN** 校验一条 `cornerRadius` 为 0 或负数的多段线
- **THEN** 校验不通过
