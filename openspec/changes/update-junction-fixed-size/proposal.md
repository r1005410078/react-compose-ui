# 变更：接线点的形状不是作者的意图

## 原因

接线点今天是一个普通曲线 Entity，因此选中就有八个缩放手柄、双击还能进顶点模式。实机上拉一下
就得到一个椭圆——而椭圆不是接线点，它只是图上一个读不出含义的疙瘩。

判据在规范里已经写着了：「默认直径 MUST 由导线线宽推出（约 3 倍），MUST NOT 是一个与线宽无关的
绝对值」。**尺寸是由别处推出来的量**，而我们给了它八个手柄去改。一个鼠标动得了却没有意义的控件
比没有更糟。

更糟的是第三层，它**看不见**：`Ports.position` 在建它的那一刻烘成 `{size/2, size/2}`，而
`getComposeEntityPorts` 原样读出、不按盒缩放。拉完之后那个圆点的视觉中心已经挪了，三条支路却
还汇聚在旧的局部坐标上。屏幕上与「接着」逐像素相同，直到用户挪一下符号才现形——而那时他不会
把这件事与两天前拉过的那一下联系起来。

## 变更内容

- **`junction` Preset 声明 `GeometryConstraints`**：`resize: 'none'`、`rotatable: false`、
  `movable: true`。`entity.transform.set` 本来就在命令层尊重这个约束，因此手柄、Inspector、
  `SCALE`、`MIRROR`、方向键微调**一次全部**收口，不必逐条路径挂钩子。挪接头照旧——那是接线图上
  的常规操作。
- **属性面板按 `GeometryConstraints` 决定只读**：`resize: 'none'` 时宽高只读、`rotatable: false`
  时旋转只读。少了这一步，面板仍然让人改、而命令会拒绝，屏幕上就是「改了没反应」——与「敲了没
  反应和敲错无法区分」是同一条既有判断。这条对**任何**声明了约束的 Entity 都成立，不是节点的特例。
- **`resize: 'none'` 的曲线不进几何编辑会话**：宿主谓词不给入口，`entity.curve.set` 同时拒绝
  并说明。两条缺一不可——前者是「不邀请」，后者是「绕不过去」；而 `entity.curve.set` 写 `Curve`
  的同时会重算盒，它是这个约束今天唯一的漏洞。
- **接线点的端口恒在盒心**成为一条可执行的不变量：盒改不了，端口因此不会漂。

**不重开曲线整体的 resize。** 曲线的 `GeometryConstraints` 曾经关过 resize（理由是「盒缩放该不该
等比缩放几何点还没定」），后来定了「盒自由、几何按 `viewBox` 与盒的比例呈现」，手柄因此回来。
这条**原样成立**：本变更只作用于 `junction`，理由完全不同——不是「还没想清楚」，而是「这个尺寸
不是作者写的，而且改它会静默弄坏绑定的落点」。

## 影响

- 受影响的规范：`basic-materials`（junction Preset、属性面板按约束只读）、`stage`（几何编辑会话
  的准入）、`compose-document`（曲线写入漏斗尊重约束）
- 受影响的代码：
  - `packages/materials/src/curve/definition.tsx`（junction Preset 补 `GeometryConstraints`）
  - `packages/materials/src/material-inspector-kit/component-inspectors.tsx`
    （`createLayoutItemInspector` 按约束决定宽高 / 旋转 / 位置只读）
  - `packages/stage/src/geometry-editing/geometry-editable.ts`（准入谓词抽成纯函数并多一条）
  - `packages/core/src/builtin-commands.ts`（`entity.curve.set` 的 `resize: 'none'` 拒绝）
- 不受影响：`Ports` 与 `Wire` 协议、接入与合并的规划、导线求解、其余四个曲线 Preset。
- **画布上的八个手柄不需要改**：`resolveStageResizeHandles` 早就按
  `GeometryConstraints.resize` 求手柄集合，`none` 时为空。这是「走约束而不是按 presetId 挡手柄」
  这个决定第一处直接兑现——声明一个字段，画布那一半自己就对了。
