## ADDED Requirements

### Requirement: 页面默认 Frame 与 Frame 级动画绑定

`ComposePageFile` MUST 升到 `pageSchemaVersion: 2`，新增 `defaultFrameId` 指向其 ComposeDocument
rootIds 中的一个 Frame。动画文件的稳定引用 MUST 保存在 Frame 上而不是页面级 `animation` 字段；
一个页面的多个根 Frame MUST 能各自绑定不同的动画文件。Store MUST 提供按 Frame 设置动画引用的
乐观并发写入。`pageSchemaVersion: 1` 文件 MUST 只能显式迁移：迁移把页面级 `animation` 移到唯一
根 Frame，并把 `defaultFrameId` 填为该 Frame。

#### Scenario: 按 Frame 绑定动画

- **WHEN** 宿主为某页面的第二个根 Frame 设置动画文件引用
- **THEN** 写入只改变该 Frame 的引用
- **AND** 第一个根 Frame 的绑定与页面其余内容保持不变

#### Scenario: 页面文件 1 到 2 显式迁移

- **WHEN** 宿主对含页面级 `animation` 的 v1 页面文件执行显式迁移
- **THEN** 该引用出现在唯一根 Frame 上，`defaultFrameId` 指向该 Frame
- **AND** 普通解析对 v1 文件返回结构化 legacy issue 且迁移不修改输入

#### Scenario: defaultFrameId 悬空

- **WHEN** `defaultFrameId` 指向文档中不存在或不是 Frame 的 id
- **THEN** 读取返回稳定 issue
- **AND** Store 不自动改写该字段

## MODIFIED Requirements

### Requirement: 页面文档读写与乐观并发

页面 Store MUST 提供聚合页面文件的读取、写入与创建，并允许文档编辑流程在保留 setupScript、
`defaultFrameId` 与各 Frame 动画绑定的前提下替换内部 ComposeDocument。写入 MUST 支持期望 revision
与显式强制覆盖；Provider 变更 MUST 使对应页面包装缓存失效。Store MUST 只写 `pageSchemaVersion: 2`
页面包装格式，不得把旧裸文档或 v1 包装写回。

#### Scenario: 期望 revision 不匹配

- **WHEN** 以过期的期望 revision 写入页面 document 或 setupScript
- **THEN** 写入失败并抛出归一化的冲突错误
- **AND** 目标页面文件未被修改

#### Scenario: 强制覆盖

- **WHEN** 在收到冲突后以强制覆盖重试写入聚合页面
- **THEN** 写入成功且 document 与 setupScript 均来自明确的本次候选
- **AND** Store 记录新的 revision

#### Scenario: 外部变更失效缓存

- **WHEN** Provider 通知某页面文件已变更
- **THEN** 该页面包装及其 document 派生缓存被失效
- **AND** 下一次读取重新向 Provider 取数

#### Scenario: 保存文档保留 setup 关联

- **WHEN** 页面编辑器只提交新的 ComposeDocument
- **THEN** Store 使用当前聚合页中的 setupScript 组装写入候选
- **AND** 文档事务不会解除或替换脚本引用

#### Scenario: 保存文档保留默认 Frame 与动画绑定

- **WHEN** 页面编辑器只提交新的 ComposeDocument 且其 rootIds 未变
- **THEN** `defaultFrameId` 与各 Frame 的动画引用保持不变
- **AND** 若原 `defaultFrameId` 指向的 Frame 已被删除，写入返回稳定 issue 而不静默改写
