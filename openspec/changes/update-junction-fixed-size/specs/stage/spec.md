## ADDED Requirements

### Requirement: 尺寸被锁死的曲线不进几何编辑会话

几何编辑会话的准入谓词 MUST 排除 `GeometryConstraints.resize` 为 `none` 的 Entity：双击不进、
`VERTEX` 命令以 `rejected` 说明、`Delete` 那一档因此也无从谈起。

理由是这条会话**就是在改盒**：`entity.curve.set` 写 `Curve` 的同时重算 `LayoutItem` 的尺寸与
offset，那是它作为「唯一漏斗」的定义的一部分。因此它是 `resize: 'none'` 今天唯一的漏洞——
`entity.transform.set` 那条拒绝完全没参与，拖一下夹点就把盒改了。

判据 MUST 读文档上的约束，MUST NOT 按 `Composition.presetId` 判断：接线点只是第一个声明这条约束
的曲线，而 Stage 不必为此多认识一种 Preset。同一条判据因此对任何宿主注入的受约束 Entity 成立。

MUST NOT 只做这一条：命令层的拒绝（见 `compose-document`）是「绕不过去」，本条是「不邀请」。
只做拒绝会让用户点进去再被拒，只做本条会留一条键盘与宿主命令都走得通的暗门。

#### Scenario: 双击接线点不进顶点模式

- **WHEN** 双击一个接线点
- **THEN** 不进入几何编辑会话，图面上不出现夹点

#### Scenario: VERTEX 对它以 rejected 说明

- **WHEN** 选中一个接线点并敲 `VERTEX`
- **THEN** 命令以 `rejected` 说明，而不是什么都不做

#### Scenario: 普通曲线照旧进得去

- **WHEN** 双击一条不带几何约束的曲线
- **THEN** 照常进入几何编辑会话
