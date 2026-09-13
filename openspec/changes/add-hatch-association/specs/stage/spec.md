## ADDED Requirements

### Requirement: 填充落地时记下边界清单

`HATCH` 落地新建一块填充时，MUST 把这次求解用到的那几个边界 Entity 的 id 写进
`Hatch.boundaryIds`。

它 MUST 取**已经算出来的那一份**——层序（把填充插在最靠后的那条边界之下）用的就是它，
MUST NOT 为此再求一次。

清单为空时 MUST NOT 写这个字段：缺席即不跟随，而空数组是非法的。

改某个既有 Entity 填充的那一支 MUST NOT 产出 `Hatch`：那一支根本不新建填充 Entity。

#### Scenario: 新建那一支写下清单

- **WHEN** 填充落成一个新 Entity
- **THEN** `Hatch.boundaryIds` 是围出这块面的那几个 Entity 的 id

#### Scenario: 没有边界时不写清单

- **WHEN** 求解没有给出任何边界 Entity
- **THEN** `Hatch` 只有 `seed`，没有 `boundaryIds`

#### Scenario: 改既有对象那一支不写 Hatch

- **WHEN** 这块面的边界恰好是某一个 Entity 的完整几何
- **THEN** 只写那个 Entity 的 `Appearance.backgroundPaint`，不产出任何 `Hatch`
