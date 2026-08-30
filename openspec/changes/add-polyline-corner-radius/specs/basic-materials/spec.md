## ADDED Requirements

### Requirement: 圆角多段线渲染成 path

曲线 Renderer MUST 在 `cornerRadius` 在场时把多段线画成 `<path>`，每个角一段圆弧、每条边
一段按切点缩短的直线；闭合时以 `Z` 收尾。缺席时 MUST 仍然是 `<polyline>` / `<polygon>`——
那一档一个字节不变，圆角只是多一条支路。

`d` MUST 由 core 求出来的那**一列**轮廓片段翻译而来，MUST NOT 在渲染层另算一遍圆角：命中与
框选读的是同一列，两处各算一遍会让「看得见的形状」与「点得中的形状」慢慢分家。

角弧的 large-arc 标志 MUST 恒为 0：内切圆角按定义不超过 180°。

曲线 Inspector MUST 提供「圆角」数值字段，与画布上的手柄是同一个值的两个入口。面板上的 0
MUST 写成**删掉这个字段**而不是写 0。

#### Scenario: 圆角在场时换成 path

- **WHEN** 渲染一条带 `cornerRadius` 的闭合四顶点多段线
- **THEN** 描边元素是 `<path>`，`d` 里有四段 `A` 与四段 `L`，以 `Z` 收尾

#### Scenario: 缺席时仍是 polygon

- **WHEN** 同一条多段线没有 `cornerRadius`
- **THEN** 描边元素仍然是 `<polygon>`
