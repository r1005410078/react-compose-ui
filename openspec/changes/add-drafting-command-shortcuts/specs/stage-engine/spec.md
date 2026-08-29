## ADDED Requirements

### Requirement: 单键快捷键同时是命令别名

绑给一条绘图命令的单键快捷键 MUST 同时出现在该命令的 `aliases` 里：用户只记一套词，
按 `P` 与敲 `P↵` MUST 指向同一条命令。

因此 `PLINE` MUST 含别名 `P`、`RECTANGLE` MUST 含 `R`、`WIRE` MUST 含 `W`、
`ARROW` MUST 含 `X`；`LINE` 的 `L`、`CIRCLE` 的 `C`、`ARC` 的 `A` 已经成立。

反向不成立：多字母别名（`WI`、`AR`、`REC`、`PL`）MUST NOT 因此被要求有对应的快捷键。

#### Scenario: 单字母别名解析到命令

- **WHEN** 以 `P`、`R`、`W`、`X` 逐一查询命令注册表
- **THEN** 分别解析出 `PLINE`、`RECTANGLE`、`WIRE`、`ARROW`

#### Scenario: 多字母别名仍然可用

- **WHEN** 以 `REC` 查询命令注册表
- **THEN** 解析出 `RECTANGLE`
