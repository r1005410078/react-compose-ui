## 上下文

`component-instance` 当前是叶子物料：内部结构整体保存在 `renderer.props.resolvedSnapshot`，由独立嵌套
Runtime 渲染，宿主 Scene Tree 只从 `document.entities` 的 `Hierarchy.childIds` 递归，因此实例必然是单节点。

本变更把实例内部提升为宿主可见、可选中、可结构编辑的层级。核心张力是：实例层此前只有属性覆盖，
现在要承载结构操作，必须与 Base/Variant 的三层 Apply/Revert 模型保持可表达、可回退、无中间态。

## 目标/非目标

- 目标：实例内部层级投影、Stage 穿透命中、实例层稳定结构操作、逐层 Apply/Revert、边界约束与迁移。
- 非目标：Detach/Unpack、跨实例或跨实例边界的移动、实例层重定义暴露属性、自动更新、ComposeDocument v7、
  放宽既有八层继承与嵌套上限。

## 决策

### 实例层与 Variant 层共用一套操作代数

实例不引入第二套覆盖语义。`instanceOverrides` 复用 Variant 已有的稳定操作表示（稳定 Entity ID、
Component Key、字符串字段路径、`parentId`、`beforeEntityId`），数组按包含它的完整字段原子处理。

这样做的关键收益是 Apply 无需翻译：把实例操作 Apply 到直接父源时，操作可以原样并入父 Variant 的操作
列表，或在父源是 Base 时按同一 Applier 落到 Base 文档。若实例层另立结构表示，Apply 就需要一个有损的
双向映射，那正是三层模型会产生无法表达中间态的来源。

属性覆盖保留为独立的 `properties` 分区而非退化成字段操作：属性是 Base 声明的稳定 property ID 契约，
与内部实体字段路径的生命周期不同，父源结构变化时二者的冲突判定规则也不同。

### Resolve 顺序与冲突判定

固定为 Base → 从根到叶的 Variant → 实例结构操作 → 实例属性覆盖。结构操作先于属性覆盖，保证属性覆盖
始终作用在最终结构上。

实例操作的目标由稳定 ID 锚定。父链更新后若锚点失效，该实例进入既有 `pending-update`，冲突以失效操作
列表呈现；用户保留旧快照，或确认丢弃冲突后一次事务提交新 lineage、快照与仍然兼容的操作。不允许自动
丢弃，也不产生半解析快照。

### 边界约束

实例子树是封闭编辑域。内部节点可在实例内部自由删除、reparent、reorder、增删 Component 与子树，但：

- 实例根不可删除、不可 reparent；
- 基础 Component 不可删除；
- reparent 的 `parentId` 必须仍在同一实例子树内，跨实例边界或移动到宿主场景一律拒绝并返回稳定 issue；
- 最终解析文档必须通过 v6 校验，否则整个操作被拒绝且实例保持上一个合法状态。

这些约束与 Variant 层完全一致，因此校验器单点实现、两层共用。

### 复合节点寻址

Scene Tree 与 Stage 选区使用 `实例ID + "/" + 内部稳定ID` 的复合地址。宿主实体沿用裸 ID，因此两类地址在
同一选区集合中可区分且不会碰撞。嵌套实例逐层拼接，天然受既有八层上限约束。

投影只发生在编辑期表示层：宿主 ComposeDocument 中实例仍是单个 Entity，`resolvedSnapshot` 与
`instanceOverrides` 是唯一持久化事实，Undo/Redo 作用于宿主文档的实例 Entity Patch。

### Stage 命中

命中索引为实例内部实体建立带复合地址的条目。默认单击选中实例整体，双击逐层下钻，与 Scene Tree
展开/选中状态双向同步。退出下钻恢复到实例整体选区。

下钻复用 InteractionController 已归一化的 `clickCount`，不新增计时逻辑。现有双击语义是文本原地编辑，
该分支由 `textEditable` 守卫，`component-instance` 不满足该谓词，因此两者互斥、无需优先级仲裁；
实现时必须保持这个互斥前提，新增下钻分支同样以 `context.tool === 'select'` 为前置条件，
并且不启动移动手势。

### 属性面板路由

选中复合地址时，Inspector 编辑写入发起实例的 `instanceOverrides`，不触碰宿主文档实体，也不写入
Base/Variant 资源。写入父源只能经由显式 Apply。

## 风险/权衡

- 实例层结构操作使实例覆盖体积可观增长：换取无需为微小差异新建 Variant；八层上限与 v1 不去重不变。
- 投影与命中索引在大场景下成本上升：投影按实例惰性展开，仅在实例节点展开或被下钻时构建。
- 三层操作合并的语义复杂度上升：通过实例与 Variant 共用同一套操作代数与校验器，把复杂度收敛到单点。
- 复合地址渗入选区 API：仅限编辑期表示层，持久化协议不变。

## 迁移计划

ComposeDocument 保持 v6。既有实例的 `propertyOverrides` 由显式纯迁移转为
`instanceOverrides.properties`，结构操作分区为空，视觉输出逐字节不变。Parser 不静默接受旧字段。
未展开实例的宿主保持现有单节点观感，行为向后兼容。

## 待解决问题

- 无。
