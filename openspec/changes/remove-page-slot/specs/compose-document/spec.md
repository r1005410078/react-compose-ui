## RENAMED Requirements

- FROM: `### Requirement: 页面引用值与嵌套护栏`
- TO: `### Requirement: 页面引用值`

## MODIFIED Requirements

### Requirement: 页面引用值

`core` MUST 定义页面引用值，其为可嵌入 `JsonObject` 的扁平字符串映射，包含 `kind` 为 `'page'`、
`providerId`、`assetKey` 与 `scope`。`core` MUST 提供从任意值读取页面引用的判别函数。

`core` MUST NOT 再提供基于祖先页面链与深度上限的嵌套状态判定——页面嵌套已被删除，组件
实例拥有自己的循环检测与深度上限，不复用这套函数。

#### Scenario: 读取页面引用

- **WHEN** 传入含 `kind` 为 `'page'` 且字段完整的值
- **THEN** 返回该页面引用
- **AND** 传入 null、非对象或字段缺失的值时返回空结果

#### Scenario: 跳转目标复用同一引用

- **WHEN** `Interaction` 的 navigate 目标写入页面引用
- **THEN** 该值与资源面板拖入产生的引用形状完全一致
- **AND** 页面重命名或移动后引用仍然有效
