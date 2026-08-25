# 文档协议规范增量

## ADDED Requirements

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
