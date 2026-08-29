## MODIFIED Requirements

### Requirement: Ports Component Inspector

`Ports` MUST 自带内建 Component Inspector，能增删端口项并编辑 id 与位置，写回 MUST 走既有的
Component 更新命令，MUST NOT 为端口新增命令——端口是一个普通 Component 的普通字段。

Inspector MUST 列出当前全部端口。它是端口的**编辑**入口；查看则不再限于此——端口在命令取点
期间会在图面上按符号整组显现（见 `stage`）。Inspector 因此 MUST NOT 依赖「图面上什么都不画」
这个前提来论证自己的存在，它的理由是编辑：改 id、改位置、增删项在图面上都做不了。

#### Scenario: 增删端口各产生一条命令

- **WHEN** 用户在 Inspector 里添加一个端口，再删掉一个
- **THEN** 各派发一条 Component 更新命令，撤销一步各自回退

#### Scenario: 列出全部端口

- **WHEN** 选中一个带两个端口的 Entity
- **THEN** Inspector 列出这两个端口的 id 与位置
