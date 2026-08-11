# pages Specification

## Purpose
TBD - created by archiving change add-page-system. Update Purpose after archive.
## Requirements
### Requirement: 独立页面 Store 包边界

`@compose-ui/pages` MUST 是无 React、无 DOM 的页面目录、应用清单与页面文档 Store 包，只能依赖
`@compose-ui/core` 与 `@compose-ui/assets`。它 MUST NOT 依赖任何 React chrome 包、
`asset-browser`、`editor`、`preview` 或 `stage`，也 MUST NOT 暴露 React 类型、HTMLElement 或
浏览器事件对象。

#### Scenario: 在无 DOM 环境构造 Store

- **WHEN** 在没有 DOM 与 React 的运行时中传入一个 Asset Provider 构造页面 Store
- **THEN** 构造成功且可完成页面列举与读取
- **AND** 不引用任何浏览器全局对象

### Requirement: 页面目录列举

页面 Store MUST 递归列举 Provider 目录树，只保留页面文件，并为每个页面产出包含稳定 `pageKey`、
条目 id、文件名、显示名、父目录与 revision 的描述符。列举结果 MUST 同时携带当前首页 key 与清单
issue 列表。列举 MUST 支持取消，MUST 合并同一时刻的重复请求。

#### Scenario: 只列举页面文件

- **WHEN** 目录树中同时存在页面文件、脚本、图片与子目录
- **THEN** 结果只包含页面文件的描述符
- **AND** 每个描述符的 `pageKey` 取自条目的稳定资源 key

#### Scenario: 取消列举

- **WHEN** 列举进行中传入的信号被中止
- **THEN** 请求以中止结束
- **AND** 不产生状态更新

#### Scenario: 合并并发列举

- **WHEN** 同一时刻发起多次列举
- **THEN** 底层 Provider 列举只执行一轮
- **AND** 所有调用方得到一致结果

### Requirement: 页面文档读写与乐观并发

页面 Store MUST 提供聚合页面文件的读取、写入与创建，并允许文档编辑流程在保留 setupScript 的前提下
替换内部 ComposeDocument。写入 MUST 支持期望 revision 与显式强制覆盖；Provider 变更 MUST 使对应页面
包装缓存失效。Store MUST 只写新页面包装格式，不得把旧裸文档写回。

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

### Requirement: 首页设置与能力门禁

页面 Store MUST 提供读取应用清单与设置首页的能力。清单不存在时首次设置首页 MUST 惰性创建清单
文件；清单不可写时 Store MUST 报告首页不可设置，且 MUST 仍能读取并暴露既有首页 key。首页 key
指向不存在的页面时 Store MUST NOT 自动清空该设置。

#### Scenario: 惰性创建清单

- **WHEN** 资源根不存在清单且首次设置首页
- **THEN** 清单文件被创建且 `homePageKey` 为目标页面
- **AND** 在此之前未发生任何写入

#### Scenario: 只读 Provider

- **WHEN** Provider 不具备写入能力
- **THEN** Store 报告首页不可设置
- **AND** 已存在的首页 key 仍可被读取

#### Scenario: 首页 key 悬空

- **WHEN** 清单中的首页 key 在当前目录中找不到对应页面
- **THEN** 列举结果保留该 key 并附带说明性 issue
- **AND** Store 不自动改写清单

### Requirement: 默认页面聚合 Loader

`@compose-ui/pages` MUST 提供由页面 Store 派生的页面 Loader，其按页面引用加载完整页面包装而不只返回
ComposeDocument，支持取消，并在底层页面文件变更时通知订阅者。Loader MUST NOT 执行 setup 脚本；
执行由更高层页面 Runtime 组合。

#### Scenario: 按引用加载

- **WHEN** 以某页面引用调用 Loader
- **THEN** 返回该页面的 document 与 setupScript 引用
- **AND** 重复加载命中 Store 缓存且不执行脚本

#### Scenario: 通知变更

- **WHEN** 已订阅页面的 document 或 setupScript 引用在 Provider 侧发生变更
- **THEN** 订阅者收到通知并在下次加载取得完整新包装
- **AND** 取消订阅后不再收到通知

### Requirement: 页面 setup 关联写入

Page Store MUST 以页面文件的 expected revision 原子改写可选 setupScript 引用，并支持关联、更换和解除。
它 MUST NOT 根据文件名或相邻目录隐式猜测脚本关系，也 MUST NOT 因解除引用自动删除脚本资源。

#### Scenario: 关联稳定 setup 引用

- **WHEN** 宿主把一个可引用 JavaScript 资源关联到页面
- **THEN** Page Store 写入其 providerId、assetKey 与持久性 scope 并返回新页面 revision
- **AND** 脚本随后重命名或移动不改变页面关联

#### Scenario: 解除脚本不删除资源

- **WHEN** 用户解除页面当前 setupScript
- **THEN** 页面包装保存 null 且 document 保持不变
- **AND** 原脚本资源仍由 Asset Provider 保留

