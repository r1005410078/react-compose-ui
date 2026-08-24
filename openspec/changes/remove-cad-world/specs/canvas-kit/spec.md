## MODIFIED Requirements

### Requirement: 无限画布基础包边界

`@compose-ui/canvas-kit` MUST 只承载**与视口有关**的画布底座，MUST NOT 认识任何文档协议、
选择集或领域命令。它 MUST 只依赖 `@compose-ui/core` 与 `@compose-ui/ui-context`，React 为
peer dependency。

以下三类 MUST NOT 进入本包：命中测试、场景渲染、手势语义。准入判据是「它认识文档或选择集
吗」——认识就不进。该判据 MUST 由包依赖与边界用例承载，MUST NOT 只靠命名约定。

本包**目前只有一个消费者**（`stage`）。这 MUST NOT 被当作把它折回宿主包的理由：边界用例
仍然可执行、仍然在挡真实的越界，而消费者数量不是判据——判据是上一段那一条。

#### Scenario: 依赖边界

- **WHEN** 检查本包的依赖清单与源码
- **THEN** 不出现 `stage`、`stage-engine`、`editor` 中的任何一个
- **AND** 源码中不出现文档或选择集类型
