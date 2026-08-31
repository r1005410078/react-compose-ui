## ADDED Requirements

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
