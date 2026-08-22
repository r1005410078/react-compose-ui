## ADDED Requirements

### Requirement: 曲线经点击添加进入激活场景并可整体操作

工具栏 MUST 提供「线」的点击添加，新线 MUST 落进激活场景且不走容器升格。曲线 MUST 参与
既有的移动手势与位置/旋转动画轨道，MUST NOT 在本能力内接受盒 resize 手势——盒缩放与几何
的关系等端点夹点能力一起决定。

页面模式的框选与多选语义 MUST 保持现状，曲线按盒参与框选。

#### Scenario: 点击添加落进激活场景

- **WHEN** 点击工具栏「线」
- **THEN** 一条默认斜线作为激活场景的子级出现，场景树同步显示

#### Scenario: 拖动整体移动

- **WHEN** 点选曲线并拖动
- **THEN** `LayoutItem.offset` 更新，几何随盒整体平移，撤销一步还原

#### Scenario: 既有动画轨道零改动可用

- **WHEN** 给曲线打位置关键帧并播放
- **THEN** 曲线随既有 `['LayoutItem','offset']` 轨道移动，无需新增动画能力

### Requirement: 线状节点不以包围盒拦截指针

带 `Curve` 的 Entity 在 Scene 中 MUST 作为线状节点渲染：节点盒本身 MUST NOT 接收指针事件，
命中 MUST 由物料内部的透明加宽 stroke 承担，其宽度 MUST 显著大于视觉线宽。

线状判定 MUST 依据 `Curve` Component 而不是 Renderer 类型——「这个 Entity 是不是线状的」是
几何问题，按物料类型枚举会在每加一种线状物料时漏掉一处。

#### Scenario: 包围盒空角不选中曲线

- **WHEN** 在非 100% 缩放下点击对角线包围盒内远离线身的空角
- **THEN** 该曲线不被选中

#### Scenario: 点击线身选中曲线

- **WHEN** 点击曲线的线身
- **THEN** 该曲线被选中并打开其属性面板
