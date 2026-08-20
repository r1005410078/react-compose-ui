## ADDED Requirements

### Requirement: Inspector 数值显示精度

物料 Inspector 自有的数值输入（位置、尺寸、边距等）MUST 与 Property Panel 采用同一显示精度：
最多 2 位小数，整数不补零，小数去掉尾随零。Fill/Hug 轴显示模式名而不是数值的行为不变。

显示精度 MUST NOT 改写底层值，也 MUST NOT 因格式化而在用户未编辑时提交。

#### Scenario: 位置与尺寸按 2 位显示

- **WHEN** 一个 Entity 的 LayoutItem 偏移为 `82.96874999999991`、宽度为 `373.3592610597958`
- **THEN** Inspector 的位置 X 显示 `82.97`，尺寸宽度显示 `373.36`

#### Scenario: Fill 轴仍显示模式名

- **WHEN** 宽度轴为 Fill
- **THEN** 尺寸宽度显示 `Fill` 而不是数值
