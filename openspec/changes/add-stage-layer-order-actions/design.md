# 设计：同级节点绘制顺序操作

## 上下文

Stage 与 Preview 都按 `rootIds` / `Hierarchy.childIds` 的 DOM 顺序绘制，靠后的同级 Entity 位于前景。
Core 已有 `entity.move` 与原子 `transaction.batch`，因此层级操作只需要规划确定的同级移动，不需要新的
持久化字段或 Core 命令。

## 目标与非目标

- 目标：四种层级动作在画布、快捷键和命令面板中结果一致，并可一次撤销。
- 目标：多选、跨父级、锁定和边界状态具有确定行为。
- 目标：Stage 与 Editor 复用无 React/DOM 的命令规划器。
- 非目标：跨容器 reparent、独立 z-index、场景树新菜单或工具栏常驻按钮。

## 决策

### 1. 只重排同级数组

`@compose-ui/stage-engine` 提供 `ComposeLayerOrderOperation`、`createLayerOrderCommand` 和
`getLayerOrderCommandAvailability`。规划器过滤缺失或锁定 Entity，以及锁定父级下的目标，再按直接父级
分组。数组越靠后表示越靠前：

- 前移/后移一层：连续选中块与相邻的一个未选中节点交换，非连续选择不会被压成一个块。
- 置顶/置底：对同级数组做稳定分区，选中节点内部和未选中节点内部顺序都不变。
- 跨父级产生一个 batch；没有可变化分组时返回不可用，不产生空事务。

Flow 与 Absolute 使用同一 Hierarchy 顺序。Flow 被重排时允许布局位置同步变化，但任何操作都不修改
LayoutItem、Transform、Renderer 或 selection。

### 2. 统一动作入口

Stage 与 Editor 增加 `edit.bringForward`、`edit.sendBackward`、`edit.bringToFront`、
`edit.sendToBack`。独立 Stage 直接调用规划器；默认 Editor 通过现有 `onShortcutAction` 接管并调用同一
执行层。右键菜单的“层级”子菜单也调用相同规划器，保持快捷键、菜单和命令面板一致。

默认键位是 `BracketRight`、`BracketLeft`、Primary+`BracketRight`、Primary+`BracketLeft`。旧偏好对象
缺少这些 key 时由 normalize 补默认值；新的动作名称、禁用原因和菜单文本提供中英文。

## 风险与权衡

- Flow 重排会改变 Auto Layout 位置，这是 `childIds` 同时承担绘制与 Flow 顺序的既有语义；不引入第二套
  order 字段。
- 右键菜单新增子菜单会改变视觉黄金；必须先检查 actual/diff，再通过专用命令更新 expected。
- 扩展 shortcut action union 可能影响宿主的穷尽 switch；保留所有既有成员和运行时缺省兼容。
