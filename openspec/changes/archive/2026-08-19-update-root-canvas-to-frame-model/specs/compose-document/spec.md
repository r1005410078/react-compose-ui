## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: 固定原点输出设置

**原因**：文档级 `output` 是隐式 Canvas 根的伪装形态——它有尺寸和背景却不能被选中、嵌套或复用，
是根画布/容器/组件根概念重叠的根源。其全部语义由一等 Frame Entity 承载。

**迁移**：`output.width/height` → 根 Frame 的 `Frame.size`；`output.backgroundPaint` → 根 Frame 的
`Appearance.backgroundPaint`；固定世界原点 `(0,0)` → 根 Frame 自身的 Transform。由 v6→v7 显式
迁移入口无损完成。

## RENAMED Requirements

- FROM: `### Requirement: 可持久化画布设置与辅助线`
- TO: `### Requirement: 可持久化编辑器画布设置`
