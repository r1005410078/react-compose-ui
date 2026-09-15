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

`kind` MUST 支持 `line`、`arc`、`polyline` 与 `path`：

- `arc` 由圆心、半径、起始角与**带符号的扫掠角**表达。MUST NOT 另立整圆类型——整圆是扫掠为
  ±360 的弧，否则归一化、平移、距离、特征点、渲染与校验六条路径各要多一份实现。
  MUST NOT 用终止角代替扫掠角：单给终止角分不出 10° 的短弧与 350° 的长弧。
- `polyline` 由顶点序列与 `closed` 布尔表达。MUST NOT 另立矩形类型——矩形是四顶点的闭合
  多段线，它唯一多出来的「四角是直角」在用户拖动某个顶点之后就不再成立。`closed` MUST 是
  布尔而不是「首尾顶点重复」：重复表示法无法区分闭合三角形与回到起点的开放折线，而两者在
  框选与捕捉上给出不同候选。
- `path` 由**子路径序列**与可选的 `fillRule` 表达。每条子路径是一个起点、一列**三次贝塞尔**
  段与一个 `closed` 布尔。

`path` 的段 MUST 全部是三次贝塞尔，直线段 MUST 规范化成控制点落在段上的三次段，
MUST NOT 另立段类型：多一种段类型就是让归一化、平移、距离、包围盒、渲染与校验六条路径各多
一支，这与「整圆是扫掠 ±360 的弧」「矩形是四顶点的闭合多段线」是同一条判断。

`path` MUST 携带子路径而不是被拆成多个 Entity：一个带洞的图形是**一条**路径的两条子路径加
`evenodd`，拆开会把洞画成一块实心的覆盖物。

`fillRule` **缺席即 `nonzero`**，`nonzero` MUST NOT 写成显式值——缺席与显式是同一件事，留两种
表示会让「填充规则是什么」在两处读出不同答案，这与 `cornerRadius` 归零时删掉字段是同一条判断，
也让本字段不需要迁移。

写入方 MUST 取能表达该几何的**最窄** kind：能用 `line`、`arc` 或 `polyline` 表达的几何
MUST NOT 落成 `path`。`path` 没有夹点，落错 kind 的症状是「这条线看起来一样却拖不动顶点」。

**拍平是这条规则的唯一例外**：它 MUST 恒落 `path`，即使产物能用 `polyline` 表达。例外由规则
自己的理由推出——上一段的理由是「落错 kind 会让用户拖不动顶点」，而拍平的**目的**正是把顶点
换成控制手柄。任何其他写入方 MUST NOT 援引本例外。

弧的紧包围盒 MUST 把落在扫掠范围内的**象限点**一并纳入，MUST NOT 只用两个端点：90° 到 270°
的弧鼓出来的那一侧在端点之外，只用端点算会让弧被自己的盒裁掉一块，而这只在跨象限的弧上出现。

同理，贝塞尔段的紧包围盒 MUST 由导数为零处的**极值点**求得，MUST NOT 取控制点凸包：凸包是
紧包围盒的超集，在 S 形段上肉眼可见地大一圈，盒会宣称对象并不占据的面积。这是象限点那条
规则的同一个应用。

新增 `kind` MUST NOT 需要迁移：既有 `line`、`arc` 与 `polyline` 文档 MUST 逐字段不变。

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

#### Scenario: 贝塞尔的盒不被控制点撑大

- **WHEN** 归一化一段控制点远在曲线之外的三次贝塞尔
- **THEN** 几何空间的范围是曲线自身的紧包围盒，而不是控制点凸包

#### Scenario: 缺席的 fillRule 不被写成显式值

- **WHEN** 写入一条填充规则为非零绕数的 `path`
- **THEN** `fillRule` 字段缺席

#### Scenario: 既有直线几何逐字段不变

- **WHEN** 归一化一条既有的直线曲线
- **THEN** 结果与新增 kind 之前一致

#### Scenario: 盒与紧包围盒不等时几何不变

- **WHEN** 盒被改成紧包围盒的两倍宽
- **THEN** `Curve` 的几何数值一个都没变

#### Scenario: 贝塞尔在非等比盒里精确投影

- **WHEN** 把一条 `path` 投影进一个宽高比与紧包围盒不同的盒
- **THEN** 控制点按仿射映射精确变换，MUST NOT 像弧那样退化成多段线

#### Scenario: 布尔运算的产物取最窄 kind

- **WHEN** 两个矩形求并集，结果全是直边且没有岛
- **THEN** 产物是闭合 `polyline` 而不是 `path`

#### Scenario: 拍平的产物恒是 path

- **WHEN** 对一个矩形拍平
- **THEN** 产物是 `path`，即使它的几何能用 `polyline` 表达

### Requirement: 曲线几何经由单一写入漏斗

端点编辑 MUST 通过一条内建命令在同一事务里写入 `Curve` 并重算 `LayoutItem` 的尺寸与
offset，MUST NOT 存在绕开该命令直接写盒或几何的第二个入口。数值 MUST 经
`roundComposeGeometry` 量化。撤销一步 MUST 回到编辑前的几何与盒。

该命令 MUST 覆盖全部 `kind`：弧与多段线的几何写入 MUST 走同一条命令，MUST NOT 各自新开入口。

**该命令 MUST 尊重 `GeometryConstraints.resize`**：`none` 时 MUST 以可判别的问题码拒绝。它重算盒
正是它作为唯一漏斗的定义的一部分，因此不认这个约束时它就是那个约束唯一的漏洞——`entity.transform.set`
早就在拒绝改尺寸，而拖一下夹点绕过了它。拒绝 MUST 与锁定那一支并列，MUST NOT 静默放行。

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

#### Scenario: 尺寸被锁死时拒绝

- **WHEN** 对一个 `resize` 为 `none` 的曲线写入新几何
- **THEN** 命令以可判别的问题码拒绝，`Curve` 与 `LayoutItem` 都不变

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
判定 MUST 把几何拍平成顶点序列后求解，弧 MUST 复用既有的弧拍平函数、贝塞尔 MUST 复用同一族的
拍平函数——第二份弧数学或第二份贝塞尔数学正是「一半改了另一半没改」的温床。

判定 MUST 按 `fillRule` 分派：缺席时按**非零绕数**，`evenodd` 时按奇偶。缺席即非零绕数
与 SVG 的默认值一致，渲染与命中因此读出同一个答案。

对单条**不自交**的轮廓两条规则给出相同答案，因此既有的 `line`、`arc` 与不自交 `polyline`
的判定结果 MUST 逐点不变。**自交轮廓上两者不同**（一笔画出来的五角星，星心在非零绕数下是
内部、在奇偶下不是），而此前这里写死奇偶、渲染却按 SVG 的默认非零绕数填充——星心是**画着
实心却点不中**的。改成两处读同一条规则顺带修掉了它，这处行为变化是有意的。

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

#### Scenario: evenodd 的洞不算内部

- **WHEN** 判定一个点是否落在 `fillRule` 为 `evenodd`、含两条同心子路径的 `path` 的内圈里
- **THEN** 为假

#### Scenario: 不自交的既有曲线判定不变

- **WHEN** 判定既有不自交 `polyline` 与 `arc` 上的任意点
- **THEN** 结果与本变更前逐点一致

#### Scenario: 自交轮廓与渲染对齐

- **WHEN** 判定一笔画出来的五角星的星心
- **THEN** 为真，与 SVG 按默认非零绕数填出来的墨一致

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

### Requirement: 可选 Layout Component

Layout MUST 只与 Hierarchy 组合，并 MUST 是按 `type` 判别的联合：`flex` 成员保存明确的
Flex direction、wrap、alignContent、justifyContent、alignItems、四边 padding、rowGap 与
columnGap；`grid` 成员见「网格 Layout 类型」。Flow LayoutItem MUST 仅位于直接拥有 Layout 的
parent 下；根级或 free parent 的子项 MUST 为 Absolute。

判别字段 `type` 缺失或不是已知成员时 MUST 拒绝，MUST NOT 回退到 `flex`——回退会让一份
写坏的 grid 文档静默渲染成一条轴上的序列，而用户无从得知。

#### Scenario: 校验 Flow 与 Absolute 位置模式
- **WHEN** Layout parent 包含 Fixed Flow 与 Absolute 子项
- **THEN** 文档通过校验且 Hierarchy.childIds 决定 Flow 顺序
- **AND** 根级 Flow、free parent 下 Flow 或非法数值被拒绝

#### Scenario: 未知布局类型被拒绝
- **WHEN** 文档里某个 Layout 的 `type` 不是 `flex` 也不是 `grid`
- **THEN** 校验拒绝并给出可定位的 issue
- **AND** MUST NOT 按 `flex` 兜底求解

### Requirement: 网格 Layout 类型

`Layout` MUST 支持 `type: 'grid'` 成员，保存列数 `columns`、行高 `rowHeight`（逻辑像素）、
`rowGap` 与 `columnGap`、四边 `padding`，以及重力开关 `float`（`false` 表示空洞被自动填上，
是默认值）。`columns` MUST 是不小于 1 的整数，`rowHeight` MUST 是有限正数，其余数值 MUST 是
有限非负数。

列宽 MUST 由容器内容宽、`columns` 与 `columnGap` 推出，MUST NOT 写进文档——同一份事实存两处
必然漂移。行高相反 MUST 由作者给定：容器宽度会随宿主变，而"一行有多高"是设计决定。

#### Scenario: 校验合法网格 Layout
- **WHEN** 容器带有 Hierarchy 与 `type: 'grid'` 的 Layout，`columns` 为 12、`rowHeight` 为 48
- **THEN** 文档通过校验
- **AND** 文档里不含任何列宽字段

#### Scenario: 拒绝非法网格参数
- **WHEN** `columns` 为 0、负数或小数，或 `rowHeight` 不是有限正数
- **THEN** 校验拒绝并给出指向该字段的 issue

### Requirement: 可选 GridItem Component

`GridItem` MUST 是可选 Entity Component，保存格坐标 `x`、`y` 与格跨度 `w`、`h`，
可选 `minW`、`minH`。全部 MUST 是整数，`x`、`y` MUST 不为负，`w`、`h` MUST 不小于 1。

**缺席即不在格中**，与 `Ports`、`Curve`、`Frame` 是同一条判断。它 MUST 只在父级拥有
`type: 'grid'` 的 Layout 时有意义；父级不是网格容器时 MUST NOT 让文档非法（切换布局类型
是一次编辑，中间态不应阻断保存），但求解 MUST 忽略它。

格中子级的 `LayoutItem.positioning` MUST 是 `flow`：它确实参与父级排布，**怎么排**由父级
Layout 的类型决定。这让既有的"根级与 free parent 下必须 Absolute"校验规则原样成立。

`w` 超出 `columns` 时 MUST 在读取时钳制到 `columns`，MUST NOT 回写——那个数是作者的意图，
容器改回更多列时应当复原。与多段线圆角的钳制是同一条判断。

#### Scenario: 校验合法 GridItem
- **WHEN** 网格容器的 Flow 子级带有 `{x: 0, y: 2, w: 4, h: 2}` 的 GridItem
- **THEN** 文档通过校验

#### Scenario: 拒绝非法格坐标
- **WHEN** `w` 小于 1、`x` 为负，或任一字段不是整数
- **THEN** 校验拒绝并给出指向该字段的 issue

#### Scenario: 跨度超出列数在读取时钳制
- **WHEN** 子级 `w` 为 16 而容器 `columns` 为 12
- **THEN** 求解按 12 格呈现
- **AND** 文档里的 `w` 仍是 16，容器改回 16 列时恢复原跨度

### Requirement: 网格求解是 core 的纯函数

网格的碰撞检测、向下推挤与重力上浮 MUST 由 `core` 的纯函数承担，输入是一组
`{id, x, y, w, h}` 与网格参数，输出是解算后的同形状一组。它 MUST NOT 读取文档、
Snapshot 或任何 React/DOM 对象。

住 `core` 而不是 `layout-engine`，判据与 `curve-geometry.ts` 逐字相同：它有两个消费者
（Layout Runtime 求解、Stage Engine 算落点），而 `stage-engine` 不依赖 `layout-engine`。
整个模块 MUST 放在一起而不按消费者拆——把推挤挪走会让碰撞数学横跨两个包。

推挤 MUST 只向下，MUST NOT 交换：尺寸不同时换不了，会让同一个动作有时交换、有时推挤。
重力 MUST 只向上，MUST NOT 向左靠：列是作者的构图意图，行不是。
次序 MUST 是**先推挤后重力**。

本次手势的目标 MUST 只在**碰撞解算**里是权威的（先按它请求的位置落下，其余子级为它让路），
MUST NOT 豁免重力。豁免会让求解**不再幂等**——把一张卡拖到空网格的第 5 行、它停在那里，
而下一次任何编辑触发重新求解时它已不再是目标，于是自己跳到第 0 行去；一个在用户没动手的
时候自己移动的对象，屏幕上没有任何东西解释它为什么动。

求解 MUST 幂等：对已经解算过的一组格矩形再求解一次 MUST 逐字段相同。

#### Scenario: 落点占住已有卡片时向下推挤
- **WHEN** 一张 4×2 的卡被放到 `(0, 2)`，那里已经有一张 7×2 的卡
- **THEN** 原有那张下移到不再重叠的第一行
- **AND** 没有被压住的卡片位置不变

#### Scenario: 重力填上空洞
- **WHEN** 重力开启且中间一行的卡片被删除
- **THEN** 下方卡片各自上浮到它们上方第一个不重叠的行
- **AND** 卡片的列坐标不变

#### Scenario: 重力关闭时保持作者行号
- **WHEN** `float` 为 `true` 且中间一行被删除
- **THEN** 下方卡片停在原行，网格中间留空

#### Scenario: 连锁推挤
- **WHEN** 落点压住 A，A 下移后压住 B，B 下移后压住 C
- **THEN** 三者依次下移到各自不再重叠的位置
- **AND** 求解终止，不产生循环

#### Scenario: 手势目标同样受重力作用
- **WHEN** 重力开启，用户把一张卡拖到空网格的第 5 行
- **THEN** 它落在第 0 行
- **AND** 对该结果再求解一次，位置不变

#### Scenario: 求解幂等
- **WHEN** 对任意一组格矩形连续求解两次
- **THEN** 两次结果逐字段相同

### Requirement: 曲线闭不闭合有一个谓词

`core` MUST 提供 `isComposeClosedCurve(curve)`，回答这条曲线是不是一块**闭合的面积**：
`polyline` 且 `closed` 为真时返回真；`arc` 在 `isComposeFullCircle` 为真（扫掠绝对值为 360）
时返回真；其余一律为假。

`arc` 上 MUST NOT 为此新增 `closed` 字段：整圆本来就是「扫掠 ±360 的弧」，另立一个字段会让
同一件事有两处表示，而 `projectComposeCurveToBox` 早就在用 `closed: isComposeFullCircle(curve)`
表达它。

`line` MUST 恒为假：两个端点表达不了一块面积。

它 MUST 是选中呈现「画盒还是画轮廓」的唯一判据。`isComposeRectangleCurve` MUST 删除——
它唯一的消费者就是这条判据，留着会让「盒是不是这个对象的轮廓」有两个读起来都像答案的入口，
而它的文档整段在讲一条已经被放宽的旧规则。

#### Scenario: 闭合多段线为真

- **WHEN** 对一条 `closed` 为真的多段线求值
- **THEN** 返回真，顶点数与是否轴对齐都不影响结果

#### Scenario: 未闭合的多段线为假

- **WHEN** 对一条 `closed` 为假的三顶点折线求值
- **THEN** 返回假

#### Scenario: 整圆为真，一段弧为假

- **WHEN** 分别对扫掠 360 的弧与扫掠 90 的弧求值
- **THEN** 前者为真、后者为假

#### Scenario: 直线为假

- **WHEN** 对一条两点直线求值
- **THEN** 返回假

### Requirement: 曲线相交与切片住在 core

`core` MUST 在 `curve-geometry.ts` 提供平面形状两两求交：线段 × 线段、线段 × 弧、弧 × 弧。
每个交点 MUST 带上它在两条形状上各自的参数（线段的 `t`、弧的角度），供上层按参数排序。落在
弧扫掠范围之外的候选 MUST NOT 算作交点；平行、共线与同心 MUST 返回空而 MUST NOT 抛错。
它 MUST 与既有平面形状运算同模块——把弧的数学拆到两个包是「一半改了另一半没改」的温床。

`core` MUST 在 `curve.ts` 提供曲线上的**位置**表达与按位置切片：`line` / `polyline` 的位置是
`{ segment, t }`，`arc` 的位置是角度；`sliceComposeCurve(curve, from, to)` MUST 返回被去掉的
那一截与剩下的曲线（零到两条）。切片 MUST 取能表达该几何的**最窄** kind：整圆去掉一截仍是
`arc`（扫掠角缩小）、一段弧被剪中间成两段 `arc`、折线中段去掉成两条 `polyline`、端段去掉即
少一个顶点、只有一段的直线去掉即什么都不剩。

**闭合折线去掉一段即变开放**：`closed` 置 `false`，顶点序列 MUST 从缺口处重排，MUST NOT 凭空
多出重合顶点。`cornerRadius` MUST 原样保留——它只作用于「角」，开放折线的两个端头不是角。
求交与切片 MUST 按**尖角顶点**而 MUST NOT 按圆角后的轮廓：多段线的顶点没有 bulge，落在角弧里的
位置没法落成一个顶点。

`path` MUST NOT 受理切片：它的截要解贝塞尔求交，v1 不做，MUST 以可判别的结果说出来。

#### Scenario: 线段与弧求交

- **WHEN** 一条水平线穿过一个整圆
- **THEN** 得到两个交点，各带线段上的 `t` 与弧上的角度

#### Scenario: 整圆切成弧

- **WHEN** 按两个角度切掉整圆的一截
- **THEN** 剩下一条 `arc`，扫掠角等于 360 减去去掉的那一截

#### Scenario: 矩形去掉一条边

- **WHEN** 按第 `i` 段的两个端点切一条四顶点闭合折线
- **THEN** 剩下一条三段开放折线，顶点从缺口处开始，`cornerRadius` 不变

#### Scenario: 折线中段成两条

- **WHEN** 切掉一条四顶点开放折线中间段的一部分
- **THEN** 剩下两条折线，交点成为各自的新端点

#### Scenario: 单段直线整条去掉

- **WHEN** 切掉一条 `line` 从起点到终点的整截
- **THEN** 剩下零条曲线

### Requirement: 填充是一个可选 Entity Component

`core` MUST 提供可选 Entity Component `Hatch`，有两个字段：

- `seed`——这块面的**锚点**，**Entity 局部坐标**，与 `Ports.position`、`Curve` 的盒局部几何
  同一个空间。求解 MUST 从这一点出发。
- `boundaryIds`——**可选**，围出这块面的那几个 Entity 的 id。**缺席 MUST 表示不跟随**。

`Hatch` 缺席 MUST 表示「这不是一块由求面产出的填充」，与 `Wire` 缺席即不是导线同一条。

几何的事实来源仍然 MUST 是 `Curve`：填充落地之后就是一条普通的闭合多段线或 `path`，
选中、resize、顶点编辑、场景树与撤销全部照常。

`Hatch` MUST NOT 存**边**级引用（某条边是与哪个对象的第几个交点，或用到了哪几段）：
一条直线穿过一个圆有两个交点，选哪一个是个启发式；而段下标在顶点被增删之后就错位。
`boundaryIds` 是 **Entity 级**的，它不回答「第几个交点」，只回答「围出这块面的是哪几个对象」，
因此不受这条禁令约束。

`Hatch` MUST NOT 存烘死的环几何——`Curve` 就是那份几何，存第二份等于给同一个形状造两个事实
来源，与导线「自由端 MUST NOT 存坐标」是同一条判断。

`Hatch` MUST 与 `Curve` 组合。两个字段都是可选新增或既有字段，因此协议版本**不变**，
既有文档 MUST 逐像素不变、不需要迁移。

#### Scenario: 缺席时与本要求引入之前一致

- **WHEN** 一个 Entity 没有 `Hatch`
- **THEN** 它的校验、渲染与命中与本要求引入之前完全一致

#### Scenario: seed 跟着 Entity 走

- **WHEN** 一个带 `Hatch` 的 Entity 被移动
- **THEN** `seed` 不变——它是 Entity 局部坐标，因此表达的仍是同一个位置

#### Scenario: 不带 Curve 的 Hatch 非法

- **WHEN** 一个 Entity 有 `Hatch` 而没有 `Curve`
- **THEN** 文档校验拒绝

#### Scenario: 没有边界清单的填充不跟随

- **WHEN** 一个带 `Hatch` 的 Entity 没有 `boundaryIds`
- **THEN** 它不参与自动跟随，行为与本变更引入之前逐字相同

#### Scenario: 空的边界清单非法

- **WHEN** `boundaryIds` 存在但是空数组
- **THEN** 文档校验拒绝——不围出任何东西的清单读不出意图，不再需要时删掉整个字段

### Requirement: 求出包含一点的那块面

`core` MUST 提供纯函数，在一组世界空间的曲线里求出**包含给定落点的那块面**。它 MUST 与既有的
命中、框选、特征点走**同一条链**：每条候选先投影进自己的盒、再乘世界矩阵。

算法 MUST 是：两两求交得到节点、节点之间的弧段即边；从落点射一条射线，按距离由近及远取穿过的
每一条边起手；沿边走，每到一个节点取**最靠右**的转向（y 向下的屏幕坐标里就是顺时针转角最大，
因此环恒把面留在右手边），回到起点即闭合；围住了落点的那一环就是这块面的**外**边界。

**不能只取最近的那一条**：落点在一个环形区域里时，射线先穿过的是那块面的**内**边界（被挖空的
那座岛），从它起手绕出来的环不含落点。因此要一条一条往外试，直到绕出来的环围住落点为止。

射线**擦过某个节点**或**与某条边相切**时，起手朝向读不出来，此时 MUST 换一个方向重来而
MUST NOT 猜——猜错一次求出来的面与用户看到的差一整块。

落在外环内部而又走不到的每个连通分量 MUST 各成一条子路径（岛），整体 MUST 写
`fillRule: 'evenodd'`——这与 `isPointInsideComposeCurve` 已有的分派读出同一个答案，因此
**看得见的洞与点不中的洞是同一个洞**。绕岛 MUST 只在该连通分量内部走：岛与外环共用节点是常事
（一条隔断的两端都顶在外框上），不限定的话会从共用节点溜回外环、绕出整块外环当岛。

产物 MUST 取能表达该几何的**最窄 kind**：没有岛且全是直边时落成闭合 `polyline`，否则落成
`path`（`polyline` 表达不了洞）。

环上相邻且**共线**的两段直边 MUST 并成一段：节点是交点造出来的，而交点不一定是这块面的角——
一根线头顶在边中间会把它切成两条，留下的顶点不携带任何形状信息，而顶点正是用户接下来要拖的
东西。这是浮点共线判定而**不是一条容差**：真差一点点的两段边在图上就是一个角。

多段线的边界 MUST 走圆角之后的那一列轮廓片段，MUST NOT 取尖角顶点：差一个圆角的**面积**是屏幕上
看得见的一块色。

走到**自由端**（只连着一条边的节点）时 MUST 掉头绕回去，MUST NOT 就此判定失败：一根伸进面里
的线头（画了一半的导线、符号的引出线）不分割任何东西，因此它不该让填充失败——把它判成断口更糟，
那个记号会指向一个根本不是缝的地方。掉头留下的零宽缝 MUST 在产物里裁掉。

失败因此由**环没有围住落点**判定：边界真的没闭合时，绕行会从缺口走到外面去。此时 MUST 拒绝，
并 MUST 报出这一圈上遇到的**全部自由端**——没有间隙容差，因此这些位置是用户唯一能据以修图的
信息，而缺口的两侧正是两个自由端。

本模块 MUST 住在 `core`，与弧的数学同一个包：它**是**平面形状运算。

**同一块面，从哪儿点都 MUST 写出同一个环。**环从射线**第一次穿过**的那条边起手，而射线是从
落点射出去的——因此在同一块面里点不同的地方会写出**起点不同的同一个环**。它在屏幕上看不出来，
却让「这一次求出来的，是不是上一次求出来的那一个」这句判断失效：换个位置再填一次会被判成另一
块面，于是在原来那块上面叠一块。因此环的起点 MUST 取**字典序最小的那个顶点**（先 x 后 y）——
走向已经由右手法则定死，起点定死之后产物就只由这块面决定。岛同理。

#### Scenario: 多个对象拼出的面

- **WHEN** 落点落在由一个矩形的三条边与一段圆弧共同围出的区域里
- **THEN** 求出的面由这四段边组成，两个边界对象一个字节不动

#### Scenario: 内部的岛被挖空

- **WHEN** 落点所在的面内部还有完全被包住的闭合曲线
- **THEN** 产物是一条 `path`，每个岛各一条子路径，`fillRule` 为 `evenodd`

#### Scenario: 全直边取最窄 kind

- **WHEN** 求出的面所有边都是直边
- **THEN** 产物是闭合 `polyline` 而不是 `path`

#### Scenario: 不封闭时报出断口

- **WHEN** 边界的一个角上缺了一小段，落点在本该围起来的那块面里
- **THEN** 求解失败，并报出缺口两侧那两个自由端的位置

#### Scenario: 伸进面里的线头被绕过去

- **WHEN** 一根线头从边界伸进面里，另一端悬空
- **THEN** 求解照常成功，产物里没有那条零宽的缝，也不报断口

#### Scenario: 叠在一起的两条边界线算一条

- **WHEN** 两条边界线画在完全相同的位置上
- **THEN** 求解照常成功，与只画一条时得到同一块面

#### Scenario: 圆角边界按圆角后的轮廓

- **WHEN** 边界里有带 `cornerRadius` 的多段线
- **THEN** 求出的面沿圆角之后的轮廓，而不是沿尖角顶点

#### Scenario: 同一块面从哪儿点都一样

- **WHEN** 在同一块**凹**形的面里从三个不同的位置各求一次
- **THEN** 三次产出的几何逐位相同

### Requirement: 求出一块面的最大内切圆圆心

`core` MUST 提供纯函数，求出一块面的**最大内切圆圆心**——离每一条边界都尽可能远的那个点。

它 MUST 把带洞的面一并算进去：洞的边界同样是边界，落在洞里的点 MUST NOT 被选中。
弧边 MUST 按固定份数采样成折线——本函数**只用来选一个点，不产出任何几何**，
因此这处近似不违反「这块画布上每条几何都是真几何」。

结果 MUST 落在这块面的内部。面退化到没有内部时 MUST 返回缺席，由调用方决定怎么办。

#### Scenario: 矩形的圆心在正中

- **WHEN** 对一个矩形求最大内切圆圆心
- **THEN** 结果是它的中心

#### Scenario: 洞把圆心推开

- **WHEN** 一块面的正中有一个洞
- **THEN** 结果落在洞之外，且不在洞里

#### Scenario: 结果恒在面内

- **WHEN** 对一块凹多边形（L 形）求最大内切圆圆心
- **THEN** 结果落在这块面的内部，而不是它包围盒的中心

#### Scenario: 退化的面返回缺席

- **WHEN** 一块面已经没有内部（面积为零）
- **THEN** 返回缺席，而不是返回一个落在边界上的点

### Requirement: 填充几何跟着边界求解，不逐条路径回写

`core` MUST 提供把全部填充解算成几何的纯函数，由布局 Runtime 在每次 solve 里调用，
与导线求解**并排**。它 MUST 返回文档与快照这**一对**——求解会改填充自己的盒，分头产出会让
命中读到的盒与渲染画出的几何差一帧。没有任何填充需要解算时 MUST 原样返回入参，引用不变。

**MUST NOT 把跟随挂在任何一条编辑路径上**：移动、方向键、Inspector、撤销、粘贴、导入与外部
同步都会改边界，漏一条的症状是「填充与边界对不上」，看起来像渲染缺陷而不是数据缺陷。
这与导线「求解不存储」是同一条判断的第二次应用。推论：跟随 MUST NOT 进撤销历史——
撤销一步回到改动之前，填充跟着回去是求解的结果而不是第二条历史记录。

没有 `boundaryIds` 的填充 MUST NOT 参与。求出来的几何与当前几何**逐位相同**时 MUST 到此为止
——不写，也不重取锚点。这既是语义也是性能：语义上那一次**没有跟随发生**，而锚点只在跟随成功
之后重取；性能上，量过一块两边界的面，**求面 0.011ms 而取锚点 1.16ms**，差一百倍，因此挡在
取锚点之前的这一道就是全部的账——五十块填充从每次 solve 59ms 降到 1ms，而那 59ms 是每一次
方向键微调都要付的。MUST NOT 为了省下那 0.011ms 去比对边界的盒与几何：换来的那点时间要用
纯函数之外的一份跨帧缓存来买。

**跟不跟 MUST 由清单判定**：重求出来的边界清单与存着的那份**相同**时 MUST 写进去，
**不同**时 MUST NOT 改动几何。拓扑变了时「跟上」意味着一次用户没有要求过的形状改变。

求不出面时 MUST 保留作者几何，与导线「任一端解算失败就用作者几何兜底」同一条。

跟随成功时 MUST 把 `Hatch.seed` 重取到新几何的**最大内切圆圆心**，并 MUST 把 `boundaryIds`
更新成这次求出来的那份。

边界 MUST 与填充**同父级**：跨层级要合成整条祖先链的变换，限制在同一父级把「嵌套时静默错位」
变成一条读得出来的问题，与 `wire.parent-mismatch` 逐字相同。清单里有跨父级的成员时
MUST NOT 跟随。

#### Scenario: 边界移动之后填充跟上

- **WHEN** 一块填充的某个边界曲线改变了几何
- **THEN** 下一次 solve 产出的文档里，这块填充的几何按新边界求出

#### Scenario: 不相干的改动不触发求解

- **WHEN** 一个不在任何填充边界清单里的 Entity 改变了几何
- **THEN** 这块填充的几何与锚点都一个字节不变

#### Scenario: 几何没变时不重取锚点

- **WHEN** 求出来的几何与当前几何逐位相同
- **THEN** 不写文档，`Hatch.seed` 保持原值——刚填出来的那块面上，用户点的地方就是他心里那块面

#### Scenario: 拓扑变了不改动几何

- **WHEN** 重求出来的边界清单与存着的那份不同
- **THEN** 填充几何一个字节不变

#### Scenario: 求不出面时保留作者几何

- **WHEN** 落点处已经没有封闭的面
- **THEN** 保留作者几何，且 `Hatch` 仍在

#### Scenario: 没有填充需要解算时引用不变

- **WHEN** 文档里没有任何带 `boundaryIds` 的填充
- **THEN** 原样返回入参的文档与快照，引用不变

#### Scenario: 跨父级的边界不跟随

- **WHEN** 清单里某个边界与填充不在同一个父级下
- **THEN** 不跟随，填充几何不变

### Requirement: 轮廓片段收成一条最窄 kind 的曲线

`core` MUST 提供纯函数，把**若干环**（每环是一列首尾相接的轮廓片段，第一环是外环、其余是岛）
收成一条 `ComposeCurve`。

产物 MUST 取能表达该几何的**最窄 kind**：只有一个环且全是直边时落成闭合 `polyline`，
否则落成 `path`；环多于一个时 MUST 写 `fillRule: 'evenodd'`，与既有的点在内部判定读出同一个
答案——因此**看得见的洞与点不中的洞是同一个洞**。弧边 MUST 转成每段至多 90° 的三次贝塞尔。

本函数 MUST 是求面与布尔运算**共用**的那一个：两处各写一遍的话，下一个改「最窄 kind」的人
只会改到其中一处，而漏掉的那处的症状是「看得见的形状与点得中的形状不是同一个」。

#### Scenario: 单环全直边

- **WHEN** 传入一个只含直线段的环
- **THEN** 得到 `closed` 为真的 `polyline`，且不带 `fillRule`

#### Scenario: 含弧边

- **WHEN** 传入一个含弧段的环
- **THEN** 得到 `path`，弧被转成每段至多 90° 的三次贝塞尔

#### Scenario: 带岛

- **WHEN** 传入一个外环与两个岛
- **THEN** 得到一条含三条子路径、`fillRule` 为 `evenodd` 的 `path`

### Requirement: 曲线布尔运算按面分类求解

`core` MUST 提供纯函数，对一组**同一坐标空间**里的操作数求并集、差集、交集与异或。
每个操作数 MUST 以它的一列轮廓片段给出，调用方负责投影（与命中、框选、特征点同一条链）。

算法 MUST 是：把**全部**操作数的片段丢进**一张**平面图（与求面共用同一份平面细分——两两求交
切子边、节点按容差合并、叠在一起的边收成一条）；对每条**半边**取它那一侧元胞里的一点，逐个
操作数问「在不在它里面」，按运算的谓词决定这块元胞留不留；一条半边**这一侧留下、对面没留**
时它在边界上；沿边界绕回起点即是结果的一条环。

判据 MUST 落在**边**上而不是面上。**枚举「面」是不够的**：绕半边只能绕出**连通分量**的环，
而一个形状整个落在另一个形状内部时两者不连通——那时绕出来的是外面那一圈，它把里面那块也算了
进去，于是「大的挖掉小的」这块元胞根本没有代表。症状是「一个矩形减掉里面一个圆」求出来是空的。

取样点让开的量 MUST 由「边中点到**其余每一条**边的最近距离」推出（取它的一半），MUST NOT 取
一个固定小量：固定小量在细长元胞上会直接跨到另一边去，而细长元胞恰恰是布尔运算最常产出的
那一类（两个矩形擦边相交）。

这个量还 MUST 被**这条边自己的曲率**钳住（弧取它的半径）：上面那条距离只保证这个半径内没有
**别的**边，而弧会自己绕回来。一个远离其余几何的小圆，它的距离是到外框的那一段，让开一半
直接跨到圆的另一侧——症状是「大矩形减掉里面一个小圆」求出来**没有洞，而且不报错**。
判别性用例 MUST 用一个既**整个在内部**、又**离每条边都远**的圆：压在边上的圆会被切成几段，
每段中点离别的边都很近，那一档在钳与不钳下都对。

四条运算 MUST 只差一个谓词，MUST NOT 各写一份绕环实现：

- 并集：在**任一个**操作数里
- 差集：在**第一个**操作数里，且不在其余任何一个里
- 交集：在**全部**操作数里
- 异或：在**奇数个**操作数里

操作数多于两个时这四句话 MUST 原样成立，MUST NOT 退化成两两归约——每一步归约都要重建一次
平面图，而中间产物的浮点误差会逐级放大。

MUST NOT 采用逐交点标「进 / 出」的边裁剪：共线重叠边、顶点落在对方边身上与弧相切各要一条
特判，而网格吸附让两个矩形共享一条边正是本产品最常出现的情形。这些退化 MUST 交给平面细分
的叠边去重与射线的多方向重试处理。

结果 MUST 是三支之一，互相可分：求出了几何、结果**没有面积**、求解**退化**（射线的每一个
候选方向都读不出朝向）。后两支 MUST NOT 合并成一个失败——「这两个形状没有重叠」与「这几个
形状算不出来」要给用户两句不同的话。

#### Scenario: 两个重叠矩形求并集

- **WHEN** 对两个部分重叠的闭合矩形求并集
- **THEN** 得到一条闭合 `polyline`，它的轮廓等于两者外缘

#### Scenario: 矩形减去圆

- **WHEN** 对一个矩形与一个压在它上面的整圆求差集，矩形是第一个操作数
- **THEN** 得到一条 `path`，圆覆盖的那一块不在其中

#### Scenario: 一个形状完全落在另一个内部时求差集

- **WHEN** 小矩形整个落在大矩形内部、两者没有任何交点
- **THEN** 得到一条含两条子路径、`fillRule` 为 `evenodd` 的 `path`，小的那个是岛

#### Scenario: 小圆整个落在大矩形内部时求差集

- **WHEN** 一个半径远小于间距的整圆整个落在大矩形内部，对它们求差集
- **THEN** 得到一条 `path`，圆心处不在形状内、矩形其余部分仍在形状内

#### Scenario: 互不相连的两个形状求并集

- **WHEN** 两个形状离得很远、没有任何交点，对它们求并集
- **THEN** 得到两条子路径，两条都是外环，一个洞都没有

#### Scenario: 三个形状求异或

- **WHEN** 对三个两两重叠的形状求异或
- **THEN** 只有落在奇数个形状里的面被保留

#### Scenario: 不相交的形状求交集

- **WHEN** 两个操作数没有任何重叠
- **THEN** 结果是「没有面积」这一支，MUST NOT 返回一条零面积的曲线

#### Scenario: 共享一条边的两个矩形

- **WHEN** 两个矩形沿网格吸附、恰好共享一条完整的边，对它们求并集
- **THEN** 求解成功，共享的那条边不出现在结果轮廓里

### Requirement: 拍平把若干几何合并成一条路径

`core` MUST 提供纯函数，把若干条几何合并成**一条** `ComposeCurve`：每条几何转成一条子路径，
弧边转成每段至多 90° 的三次贝塞尔。它 MUST NOT 求交、MUST NOT 做任何区域判定。

产物 MUST 恒是 `path`，`fillRule` MUST 缺席（即 `nonzero`）。只传入一条几何时同样成立。

#### Scenario: 拍平一个圆角矩形

- **WHEN** 对一条带 `cornerRadius` 的闭合 `polyline` 拍平
- **THEN** 得到一条 `path`，圆角被表达成三次贝塞尔段，轮廓与拍平前一致

#### Scenario: 拍平两个分离的形状

- **WHEN** 对两个互不相交的形状拍平
- **THEN** 得到一条含两条子路径的 `path`

### Requirement: 三次贝塞尔能被识别回圆弧或直线

`core` MUST 提供纯函数，判断一条三次贝塞尔段是不是一段圆弧或一条直线，并给出那段弧或直线。

直线的判据 MUST 是**控制点落在弦上**（叉积近零且投影落在 `[0, 1]` 内）。

圆弧的判据 MUST 是：过起点、曲线中点 `B(0.5)` 与终点三点定圆；扫掠角取经过中点的那一侧且
MUST NOT 超过 90°（生成侧每段至多 90°，更长的弧一定是两段；这一条同时收走了「从反方向绕远路
连起两个端点」的情形）；再**在曲线上取样**，每个样点到圆心的距离与半径之差 MUST 都在容差内。

验证 MUST 落在**曲线的轨迹**上而不是**拟合出来的参数**上。按圆心与半径判等是错的：浅弧的
半径由矢高反解（`r ≈ 弦²/8矢高`），而矢高本身只有几个量化步长，坐标舍入因此能让半径差出几
成——可它带来的**形状**误差仍然只有舍入那么大。三点定出的圆与真弧在三处吻合，中间也就处处
吻合，这是拟合在**函数**意义上稳定而在**参数**意义上不稳定的标准情形。取样还顺带答对了另一
个问题：参数化不影响轨迹，因此沿同一个圆非匀速走过的三次段本来就该认成这段弧。

容差 MUST 是 `max(五个量化步长, 弦长的千分之二)`。前一项来自坐标量化：控制点与端点各自最多
差半个量子，五个量子盖住最坏情形还留一倍余量。后一项覆盖**盒被放大过**的情形——投影是等比
仿射时几何与量化误差同步放大，而弦长是这条段自己携带的、唯一能读出放大倍数的量；千分之二在
一条 200 单位的弦上是 0.4，在常用缩放下不到一个像素。MUST NOT 只取相对量：半径 2 与半径 500
的弧舍入误差是同一个绝对量，按比例取会让小弧永远认不出来。

**矢高只有几个量化步长的弧 MUST 认成直线段而不是弧**：控制点到弦的距离约等于矢高的 4/3，
因此「先试直线」用同一个容差就把这一档收走了。这是对的而不是将就——那样的弧半径已不可复原
（三个拟合点几乎共线，定圆本身可能无解），而按直线参与运算引入的形状误差不超过容差，在常用
缩放下不到一个像素。代价写在明处：极浅的弧在结果里落成直边。

#### Scenario: 生成的弧段认回同一段弧

- **WHEN** 半径 2 到 500、扫掠 30° 到 90°、两个方向的弧经闭式解转成三次段并舍入到两位小数
- **THEN** 每一段都被识别为弧，且认出来的弧与原弧在整段上处处吻合到容差之内

#### Scenario: 矢高只有几个量化步长的弧认成直线

- **WHEN** 一段半径 2、扫掠 5° 的弧（矢高不到坐标量化步长的五分之一）转成三次段
- **THEN** 它被识别为直线段——在存储精度下它就是一条直线，半径已不可复原

#### Scenario: 控制点落在弦上的段是直线

- **WHEN** 一条三次段的两个控制点分别落在弦的三分之一与三分之二处
- **THEN** 它被识别为直线段，不是弧

#### Scenario: 自由贝塞尔不认

- **WHEN** 一条三次段的两个控制点分别落在弦的两侧（S 形）
- **THEN** 它既不被识别为弧，也不被识别为直线

#### Scenario: 超过 90° 的段不认

- **WHEN** 一段 120° 的弧被凑成一条三次段
- **THEN** 它不被识别为弧

### Requirement: 布尔操作数可以自带内外判定用的曲线

`ComposeBooleanOperand` MUST 允许可选地带上一条曲线，内外判定优先读它；缺席时 MUST 由片段
收成一条单环曲线，行为与此前逐字不变。

理由是一块带岛的填充是两条子路径加 `evenodd`：片段摊平之后收成「一条环」会把岛算进去，
内外判定就反了。

#### Scenario: 带岛的操作数以自己的规则判内外

- **WHEN** 一个外环加一个内环、`fillRule` 为 `evenodd` 的操作数带着自己的曲线，与一个整个落在
  岛里的矩形求交集
- **THEN** 结果是「没有面积」——岛不属于它

#### Scenario: 缺席时行为不变

- **WHEN** 操作数没有带曲线
- **THEN** 内外判定由片段收成的单环曲线给出，与此前相同

### Requirement: 三次贝塞尔的紧包围盒在二次项退化时仍然正确

解三次段导数为零的参数 MUST 用数值稳定的求根式。二次项系数 `−p0 + 3p1 − 3p2 + p3` 在端点与
控制点于该轴两两相等时精确为零，而浮点算出来是 1e-15 量级——朴素的 `(−b ± √D) / 2a` 在这一档
发生**灾难性抵消**，两个根一个溢出成 1e16、一个落在 `(0, 1)` 之外，真正的根整个丢掉。

症状离求根很远：紧包围盒因此少算一截，而**盒与 `viewBox` 都读这个包围盒**，几何于是被按两者
的比例拉开——一段圆弧被拉成椭圆弧。`HATCH` 求面产出的上下对称弧边经归一化写进文档之后正好
落在这一档。

#### Scenario: 对称弧段的极值不丢

- **WHEN** 一段三次贝塞尔的两端与两个控制点在 x 轴上两两相等，坐标已按文档精度舍到两位
- **THEN** 紧包围盒含 `t = 0.5` 处的极值，宽度是真实的那一段而不是两端之差

