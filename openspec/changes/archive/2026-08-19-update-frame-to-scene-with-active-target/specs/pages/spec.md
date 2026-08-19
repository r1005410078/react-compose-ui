## MODIFIED Requirements

### Requirement: 页面激活 Frame 与 Frame 级动画绑定

`ComposePageFile` MUST 升到 `pageSchemaVersion: 3`，以 `activeFrameId` 指向其 ComposeDocument
rootIds 中的一个 Frame。`activeFrameId` 是页面的**激活目标**：它 MUST 决定预览的默认目标与
「生成真实页面」时渲染的 Frame，并 MUST 在没有任何选择时作为 Frame 相关动作的回退目标；
它 MUST NOT 覆盖显式选择。动画文件的稳定引用 MUST 保存在 Frame 上而不是页面级 `animation`
字段；一个页面的多个根 Frame MUST 能各自绑定不同的动画文件。Store MUST 提供按 Frame 设置
动画引用的乐观并发写入，以及设置 `activeFrameId` 的乐观并发写入；后者 MUST 拒绝不在 rootIds
中的 id。`pageSchemaVersion: 1` 与 `2` 文件 MUST 只能显式迁移：1→2 把页面级 `animation` 移到
唯一根 Frame 并填充默认 Frame；2→3 把 `defaultFrameId` 恒等改名为 `activeFrameId`。

#### Scenario: 按 Frame 绑定动画

- **WHEN** 宿主为某页面的第二个根 Frame 设置动画文件引用
- **THEN** 写入只改变该 Frame 的引用
- **AND** 第一个根 Frame 的绑定与页面其余内容保持不变

#### Scenario: 页面文件 1 到 2 显式迁移

- **WHEN** 宿主对含页面级 `animation` 的 v1 页面文件执行显式迁移
- **THEN** 该引用出现在唯一根 Frame 上，激活 Frame 指向该 Frame
- **AND** 普通解析对 v1 文件返回结构化 legacy issue 且迁移不修改输入

#### Scenario: 页面文件 2 到 3 显式迁移

- **WHEN** 宿主对含 `defaultFrameId` 的 v2 页面文件执行显式迁移
- **THEN** 得到 `pageSchemaVersion: 3` 且 `activeFrameId` 等于原 `defaultFrameId` 的页面文件
- **AND** 普通解析对 v2 文件返回结构化 legacy issue，且迁移不修改输入

#### Scenario: defaultFrameId 悬空

- **WHEN** `activeFrameId` 指向文档中不存在或不是 Frame 的 id
- **THEN** 读取返回稳定 issue
- **AND** Store 不自动改写该字段

#### Scenario: 设置激活 Frame

- **WHEN** 宿主把页面的激活 Frame 设为另一个根 Frame
- **THEN** Store 以期望 revision 原子改写 `activeFrameId` 并返回新 revision
- **AND** 目标 id 不在 `rootIds` 中时写入被拒绝且页面文件未被修改

### Requirement: 页面文档读写与乐观并发

页面 Store MUST 提供聚合页面文件的读取、写入与创建，并允许文档编辑流程在保留 setupScript、
`activeFrameId` 与各 Frame 动画绑定的前提下替换内部 ComposeDocument。写入 MUST 支持期望 revision
与显式强制覆盖；Provider 变更 MUST 使对应页面包装缓存失效。Store MUST 只写 `pageSchemaVersion: 3`
页面包装格式，不得把旧裸文档、v1 或 v2 包装写回。

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
- **THEN** `activeFrameId` 与各 Frame 的动画引用保持不变
- **AND** 若原 `activeFrameId` 指向的 Frame 已被删除，写入返回稳定 issue 而不静默改写

## RENAMED Requirements

- FROM: `### Requirement: 页面默认 Frame 与 Frame 级动画绑定`
- TO: `### Requirement: 页面激活 Frame 与 Frame 级动画绑定`
