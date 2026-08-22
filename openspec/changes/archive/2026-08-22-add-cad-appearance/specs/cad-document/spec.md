## ADDED Requirements

### Requirement: CAD 图元外观覆盖

系统 MUST 提供可选的 `CadStroke` Component，含 `color`、`width` 与 `dashPattern` 三个**各自
可选**的字段。缺省 MUST 表示回退：颜色回退到所属图层，线宽回退到默认值，线型回退到实线。

清除某一项 MUST 表现为**删掉那个键**，MUST NOT 写入哨兵值——否则「显式设成无」与「跟随图层」
会变成两个都要处理的状态。三项全被清除时整个 Component MUST 一并删除。

系统 MUST 提供唯一的解析入口，返回已经落实的颜色、线宽与虚线；渲染 MUST 只消费解析结果。

`schemaVersion` MUST NOT 因此改变，且不含 `CadStroke` 的既有文档的解析结果 MUST 与引入本能力
之前逐字相同。

#### Scenario: 缺省逐项回退

- **WHEN** 一个图元只覆盖了颜色
- **THEN** 它按覆盖的颜色画，线宽与线型仍取默认
- **AND** 修改所属图层的颜色不再影响它

#### Scenario: 既有文档表现不变

- **WHEN** 解析一个不含 `CadStroke` 的图元
- **THEN** 颜色等于图层颜色，线宽等于默认值，线型为实线

#### Scenario: 非法外观被拒绝

- **WHEN** 校验一份线宽非正、颜色不是字符串或虚线段含非正数的文档
- **THEN** 校验失败并给出稳定机器码

### Requirement: CAD 线宽与虚线的单位

线宽 MUST 以**屏幕像素**表达，MUST NOT 随缩放变化——它是显示宽度，与 AutoCAD 的 lineweight
一致；放大图纸时一根粗线会变成色带，而用户放大恰恰是为了看清结构。

虚线间隔 MUST 以**世界单位**表达，MUST 随缩放变化——它是图上的实际长度，与 AutoCAD 的
linetype 一致；写成屏幕像素会让虚线密度在任何缩放下都一样，那条线因此不再携带长度信息。

#### Scenario: 缩放时线宽不变而虚线变密

- **WHEN** 视图放大一倍
- **THEN** 线宽的屏幕像素数不变
- **AND** 虚线段的屏幕长度随之加倍

### Requirement: CAD 块实例的外观由实例决定

块内图元自身的 `CadStroke` MUST NOT 参与解析，整个实例 MUST 按实例自己的外观呈现。

这沿用图层的既有判断：让块内图元各自决定外观，同一个块在不同插入处会呈现不同，那就不是块。

#### Scenario: 实例的外观覆盖整个符号

- **WHEN** 给一个块实例设置颜色
- **THEN** 该实例展开出的全部几何都按这个颜色画
- **AND** 同一个块的其他实例不受影响

### Requirement: CAD COLOR、LWEIGHT 与 LTYPE 命令

系统 MUST 提供 `COLOR`（别名 `COL`）、`LWEIGHT`（别名 `LW`）与 `LTYPE`（别名 `LT`）三条命令，
流程一致：取选择集（启动时已有选择则直接使用），再收一个值。

三条 MUST 接受 `BYLAYER`（大小写不敏感）表示清除该项覆盖；`LTYPE` MUST 额外接受
`CONTINUOUS`。颜色 MUST 接受十六进制与九个标准色名，线宽 MUST 是正数，线型 MUST 是一串正数。

值解析失败时 MUST 拒绝且**不结束命令**——打错一个值就要重新选一遍对象，在 CAD 里是不可接受
的手感。

一次修改 MUST 作为一个事务提交，使一次撤销回到修改之前。

#### Scenario: 先选后执行改颜色

- **WHEN** 用户选中若干图元并执行 `COLOR`，键入一个颜色
- **THEN** 这些图元按该颜色画
- **AND** 一次撤销回到修改之前

#### Scenario: BYLAYER 清除覆盖

- **WHEN** 用户对已有颜色覆盖的图元执行 `COLOR` 并键入 `BYLAYER`
- **THEN** 该图元回到图层颜色
- **AND** 三项都被清除后文档里不再留下空的外观 Component

#### Scenario: 值不合法时命令继续

- **WHEN** 用户在 `LWEIGHT` 键入 0 或一个非数字
- **THEN** 命令拒绝并停在原提示
- **AND** 换一个合法值仍能完成
