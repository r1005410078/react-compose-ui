## ADDED Requirements

### Requirement: 组件实例的内容缩放

组件实例 MUST 提供 Renderer prop `contentFit`，取值 `'layout'` 或 `'scale'`，**默认
`'layout'`**——它是既有行为，因此不含该 prop 的既有文档渲染 MUST 逐像素不变。

`'layout'` 下实例 resize MUST 保持既有机制：把尺寸写进嵌套根 Frame，Auto Layout 的 `fill`
子级随之重排。`'scale'` 下 MUST NOT 改写嵌套根 Frame 的尺寸，而是按盒与组件根尺寸的比值把
嵌套内容整体缩放。两支 MUST NOT 同时改写同一份尺寸数据：那会让「这个实例多大」在两处读出不同
答案，症状是拖一次角手柄图形跳两次。

`'scale'` 的缩放 MUST 按两轴**各自**的比值，MUST NOT 强行等比后留白——曲线按 `viewBox` 跟随
自己的盒时就是两轴各算各的，符号被拉扁时它的每一条线也该跟着扁。需要等比时用户按住既有的
resize 约束修饰键，MUST NOT 在此另造一个开关。

它 MUST 是 Renderer prop 而不是新的 Component：只有渲染与 Inspector 读它，不参与命中判定或
布局求解，落在 props 上还白拿数据绑定与外观关键帧轨道。

#### Scenario: 默认行为不变

- **WHEN** 渲染一个不声明 `contentFit` 的既有实例并拖角手柄
- **THEN** 行为与本变更前逐像素一致，Auto Layout 子级照常重排

#### Scenario: scale 下绝对定位子级跟着放大

- **WHEN** 一个 `contentFit` 为 `'scale'`、内部全是绝对定位几何的实例被拖成两倍宽高
- **THEN** 内部图形整体放大两倍，嵌套根 Frame 的尺寸没有被改写

#### Scenario: 非等比拖动两轴各自缩放

- **WHEN** 把 `'scale'` 实例只拖宽一倍
- **THEN** 内容横向拉伸一倍，纵向不变

#### Scenario: 下钻选中框跟随缩放

- **WHEN** 在放大后的 `'scale'` 实例内部下钻选中一个 Entity
- **THEN** 选中框与屏幕上放大后的图形对齐
