## ADDED Requirements

### Requirement: 组件实例的翻转

组件实例 MUST 提供 Renderer prop `flip`，取值 `'none' | 'x' | 'y' | 'xy'`，**默认 `'none'`**
——不声明该 prop 的既有实例渲染 MUST 逐像素不变。

翻转 MUST 作用于实例的呈现，MUST NOT 改写组件定义：定义是共享的，改它会波及每一个实例。
它 MUST 与既有的 `Transform.rotation` 组合表达任意轴的反射——绕角 θ 的反射等于 `flipX` 之后
旋转 `2θ`，因此不需要为镜像新增任何协议字段。

翻转 MUST 绕实例盒的中心发生，MUST NOT 读 `Transform.pivot`：`pivot` 回答的是「绕哪一点旋转」，
把它借给翻转会让改基点的用户看到图形整个跳走。

下钻选中与命中沿用既有的 DOM 测量，因此翻转对它们透明。

#### Scenario: 默认不翻转

- **WHEN** 渲染一个不声明 `flip` 的既有实例
- **THEN** 渲染结果与本变更前逐像素一致

#### Scenario: 水平翻转不改定义

- **WHEN** 把一个实例的 `flip` 设为 `'x'`
- **THEN** 该实例左右镜像，组件文档与其他实例都没有变化

#### Scenario: 翻转绕盒中心

- **WHEN** 一个 `pivot` 设在左边中点的实例被水平翻转
- **THEN** 图形绕盒中心镜像，位置不跳
