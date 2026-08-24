# basic-materials 规范增量

## ADDED Requirements

### Requirement: Ports Component Inspector

`Ports` MUST 自带内建 Component Inspector，能增删端口项并编辑 id 与位置，写回 MUST 走既有的
Component 更新命令，MUST NOT 为端口新增命令——端口是一个普通 Component 的普通字段。

Inspector MUST 列出当前全部端口。端口在图面上不绘制标记，因此 Inspector 是用户确认「这个符号
有哪些接线点」的唯一入口。

#### Scenario: 增删端口各产生一条命令

- **WHEN** 用户在 Inspector 里添加一个端口，再删掉一个
- **THEN** 各派发一条 Component 更新命令，撤销一步各自回退

#### Scenario: 列出全部端口

- **WHEN** 选中一个带两个端口的 Entity
- **THEN** Inspector 列出这两个端口的 id 与位置
