## ADDED Requirements

### Requirement: Renderer Props 的批量规划

系统 MUST 提供一个纯规划函数，按**一组** Entity 把一份 props **patch** 写入，产出**一条**
batch 命令：多选批量改属性 MUST 只占一步撤销。

patch MUST 合到**每个目标各自**的 authored props 上，MUST NOT 拿其中一条的整份 props 去覆盖
全部目标——后者会把别人身上不在 patch 里的属性一起改掉，而这个错误在屏幕上看不见，要等用户
去看那一条才发现。

没有 Renderer 的目标 MUST 跳过（容器没有 props 可写），**锁定**的目标 MUST 跳过。一个目标都
不剩时 MUST 返回 `null` 而不是一条空 batch——空事务会进撤销历史，撤销一步什么都不发生。

单选 MUST 是这一组恰好一个成员的退化情形，与文字样式的四件事、时间线的关键帧选区是同一条
判断。

#### Scenario: 一份 patch 合到各自的 props 上

- **WHEN** 选中两条曲线，一条线宽 2、一条线宽 5，把线条颜色改成红
- **THEN** 两条的 `stroke` 都变成红
- **AND** 两条的 `strokeWidth` 分别仍是 2 与 5

#### Scenario: 批量改属性只占一步撤销

- **WHEN** 选中 36 条曲线并改线条颜色
- **THEN** 全部目标在**一条** batch 命令里被写入
- **AND** 撤销一步全部回到改之前

#### Scenario: 跳过没有 Renderer 与锁定的目标

- **WHEN** 选区里含容器、锁定的曲线与未锁定的曲线
- **THEN** 只有未锁定且带 Renderer 的那些被写入
- **AND** 一个可写目标都没有时规划返回 `null`
