## ADDED Requirements

### Requirement: CadDocument v1 协议

系统 MUST 提供独立于 ComposeDocument 的 `CadDocument` v1 文档协议。该协议 MUST 复用
`ComposeEntity` 的 ECS 结构，使 Patch 代数、事务运行时、Undo/Redo 与序列化全部共用，
差异只体现在校验器与 Component 词汇上。

文档 MUST 声明 `schemaVersion` 为 1 且单位固定为 `px`，MUST NOT 携带任何画布或图纸尺寸——
CAD 是无限图纸，没有输出边界。

文档 MUST 至少包含一个图层，每个图层 MUST 有文档内唯一的 id。空文档 MUST 带有默认图层。

校验 MUST 返回与 ComposeDocument 校验同形的结果：合法时给出规范化后的文档，非法时给出
带稳定机器码的问题列表。校验器 MUST 可直接注入通用事务运行时。

#### Scenario: 空文档合法且带默认图层

- **WHEN** 创建一份新的空 CAD 文档
- **THEN** 校验通过
- **AND** 文档含有恰好一个图层，没有 Entity

#### Scenario: 缺少图层被拒绝

- **WHEN** 校验一份图层列表为空的文档
- **THEN** 校验失败并给出对应的机器码
- **AND** 图层 id 重复时同样失败

#### Scenario: 结构完整性

- **WHEN** `rootIds` 指向不存在的 Entity，或 `entities` 的 key 与 Entity 自身 id 不一致
- **THEN** 校验失败
- **AND** 未被任何根引用且不是任何 Entity 子级的孤儿同样被拒绝

#### Scenario: 接入通用事务运行时

- **WHEN** 用 CAD 校验器创建事务运行时并派发命令
- **THEN** dispatch、Undo、Redo 与历史导航按既有语义工作
- **AND** 运行时不注册 ComposeDocument 的内建命令

### Requirement: CAD 文件协议与 Store

CAD 文档 MUST 以 `.cad.json` 为文件后缀持久化，并具有独立的媒体类型。系统 MUST 提供绑定
Asset Provider 的 CAD Store，支持列举、读取、新建与带 revision 校验的保存。

Store 在写入前 MUST 校验文档，MUST NOT 把非法内容落盘。列举时单个文件损坏 MUST NOT 阻断
其余文件。

#### Scenario: 新建后可读回

- **WHEN** 通过 Store 新建一份 CAD 文件并随后读取
- **THEN** 读到的文档与写入的一致
- **AND** 返回的 revision 可用于后续保存的乐观并发校验

#### Scenario: 拒绝写入非法文档

- **WHEN** 保存一份校验不通过的文档
- **THEN** 写入被拒绝并抛出说明原因的错误
- **AND** Provider 上的既有文件不被改动

#### Scenario: 损坏文件不阻断列举

- **WHEN** 目录中存在一个无法解析的 `.cad.json`
- **THEN** 列举仍返回其余可用的 CAD 文档
- **AND** 损坏项以问题列表形式单独报告
