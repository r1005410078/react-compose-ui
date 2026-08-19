## MODIFIED Requirements

### Requirement: 页面激活 Frame 与 Frame 级动画绑定

`ComposePageFile` MUST 升到 `pageSchemaVersion: 3`，以 `activeFrameId` 指向其 ComposeDocument
rootIds 中的一个 Frame。`activeFrameId` 是页面的**激活目标**：它 MUST 决定预览的默认目标与
「生成真实页面」时渲染的 Frame，并 MUST 在没有任何选择时作为 Frame 相关动作的回退目标；
它 MUST NOT 覆盖显式选择。动画文件的稳定引用 MUST 保存在 Frame 上而不是页面级 `animation`
字段；一个页面的多个根 Frame MUST 能各自持有独立的引用，并 MAY 指向同一个动画文件——文件
按所属 Frame 分区，因此一页共用一份文件时各场景的动画仍互不影响。解除某个 Frame 的引用
MUST NOT 改变其他 Frame 的引用。Store MUST 提供按 Frame 设置动画引用的乐观并发写入，以及
设置 `activeFrameId` 的乐观并发写入；后者 MUST 拒绝不在 rootIds 中的 id。前者是宿主可用的
页面文件级入口，MUST NOT 成为编辑器内交互绑定的必经路径——`Animations.source` 是文档状态，
编辑器 MUST 通过文档命令改写它，否则尚未保存的场景无法绑定动画。
`pageSchemaVersion: 1` 与 `2` 文件 MUST 只能显式迁移：1→2 把页面级 `animation` 移到唯一根
Frame 并填充默认 Frame；2→3 把 `defaultFrameId` 恒等改名为 `activeFrameId`。

#### Scenario: 按 Frame 绑定动画

- **WHEN** 宿主为某页面的第二个根 Frame 设置动画文件引用
- **THEN** 写入只改变该 Frame 的引用
- **AND** 第一个根 Frame 的绑定与页面其余内容保持不变

#### Scenario: 多个根 Frame 指向同一动画文件

- **WHEN** 页面的两个根 Frame 都引用同一个动画文件，用户解除其中一个的引用
- **THEN** 只有该 Frame 的 `Animations.source` 被清空
- **AND** 另一个 Frame 的引用与该动画文件本身都保持不变

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
