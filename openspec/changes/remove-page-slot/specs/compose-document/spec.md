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

## ADDED Requirements

### Requirement: page-slot Entity 显式迁移

`core` MUST 提供显式单向迁移，把文档中 `Renderer.type` 为 `'page-slot'` 的 Entity 降级为保留
原 Transform、LayoutItem 与 Appearance 的空 Container。迁移 MUST 返回稳定 issue，逐条列出被
降级的 Entity 与它原本引用的页面，使宿主能够提示用户手工改用组件实例。

迁移 MUST 是显式调用的纯函数，MUST NOT 在普通解析中自动发生，也 MUST NOT 修改输入文档。
普通解析遇到 `page-slot` Entity MUST 返回可判别的 legacy issue，MUST NOT 静默丢弃该 Entity
或其几何。

迁移 MUST NOT 尝试创建任何资源——把被内嵌页面转换为组件资产需要写入 Provider，超出纯
函数迁移的能力边界。

#### Scenario: 降级为占位容器

- **WHEN** 对含两个 page-slot Entity 的文档执行显式迁移
- **THEN** 两个 Entity 变成空 Container 且位置、尺寸与外观保持不变
- **AND** 结果附带列出两个原页面引用的稳定 issue

#### Scenario: 普通解析返回 legacy issue

- **WHEN** 普通解析一个含 page-slot Entity 的文档
- **THEN** 返回可判别的 legacy issue
- **AND** 输入文档不被修改且该 Entity 的几何不丢失

#### Scenario: 迁移不写入资源

- **WHEN** 执行显式迁移
- **THEN** 不发生任何 Provider 写入
- **AND** 原页面文件保持不变
