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

### Requirement: 重新生成把几何、锚点与清单一起写回

「重新生成」MUST 在**同一个事务**里写三样：新几何、重取的锚点、这次求出来的边界清单。

锚点 MUST 重取到新几何的**最大内切圆圆心**，与每帧那条派生求解逐字相同：两条路走出不同的
锚点，等于同一块填充按不同入口重算会得到不同结果。只写几何 MUST NOT 视为完成——盒跟着新
几何变了，而锚点是**相对盒**的，不重写它每按一次锚点就往外漂一点，几次之后掉到界外，此后
这块填充再也重算不回来。

清单 MUST 更新成这次求出来的那份。不更新的话这块填充此后**永远跟不上**——派生那一侧比对的
是存着的那份，而它记的还是上一次那几个边界；而用户按下那一下想说的正是「现在这几个才是我
的边界」。推论：一块**没有**清单的既有填充，第一次「重新生成」就把清单补上，此后开始跟随。

清单为空时 MUST NOT 写这个字段，与落地那一支同一条。

#### Scenario: 重新生成之后清单跟着更新

- **WHEN** 一个边界被挪走、用户按「重新生成」，此后再动剩下的某个边界
- **THEN** 填充跟着动——清单已经换成重算时用的那几个

#### Scenario: 已落地的填充第一次重新生成即补上清单

- **WHEN** 一块没有 `boundaryIds` 的既有填充被「重新生成」
- **THEN** `Hatch.boundaryIds` 被写上，此后它跟着边界走

#### Scenario: 锚点重取到最大内切圆圆心

- **WHEN** 重新生成求出了一块新的面
- **THEN** `Hatch.seed` 是这块新面的最大内切圆圆心，而不是原来那个相对盒的旧值
