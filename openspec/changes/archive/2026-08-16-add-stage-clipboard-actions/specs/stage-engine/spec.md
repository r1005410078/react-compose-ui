## ADDED Requirements

### Requirement: Entity 会话剪贴板规划

Stage Engine MUST 提供与 React 无关的会话剪贴板规划：从选择规范化复制/剪切来源、解析建议粘贴
落点，以及把剪贴板转成既有 `entity.duplicate` 或移动/reparent 命令。规范化 MUST 按文档遍历顺序
保留顶层来源并去掉已被祖先覆盖的后代。剪切来源 MUST 排除锁定节点；粘贴到自身、后代或锁定父级
MUST 判定为不可用且不产生命令。

#### Scenario: 规范化多选复制来源

- **WHEN** 选择同时包含容器及其子项并请求复制
- **THEN** 剪贴板只保留该容器
- **AND** 锁定节点仍可进入复制剪贴板

#### Scenario: 建议落点

- **WHEN** 目标是未锁定容器、叶节点或空选区
- **THEN** 分别解析为容器末尾、该节点之后或根级末尾

#### Scenario: 复制到指定父级

- **WHEN** 规划器为复制剪贴板提供与来源不同的父级
- **THEN** 生成的 duplicate 命令写入该父级与索引
- **AND** Absolute 副本不再额外偏移 10
