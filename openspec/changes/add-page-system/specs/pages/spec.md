## ADDED Requirements

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

页面 Store MUST 提供页面文档的读取、写入与创建。写入 MUST 支持传入期望 revision 以启用乐观
并发；当 Provider 报告冲突时 Store MUST 以归一化的资源错误暴露该冲突，并 MUST 支持显式强制覆盖。
Store MUST 按页面 key 缓存文档，并 MUST 在 Provider 通知变更时失效对应缓存。

#### Scenario: 期望 revision 不匹配

- **WHEN** 以过期的期望 revision 写入页面
- **THEN** 写入失败并抛出归一化的冲突错误
- **AND** 目标文件未被修改

#### Scenario: 强制覆盖

- **WHEN** 在收到冲突后以强制覆盖重试写入
- **THEN** 写入成功
- **AND** Store 记录新的 revision

#### Scenario: 外部变更失效缓存

- **WHEN** Provider 通知某页面已变更
- **THEN** 该页面的缓存文档被失效
- **AND** 下一次读取重新向 Provider 取数

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

### Requirement: 默认页面文档 Loader

`@compose-ui/pages` MUST 提供由页面 Store 派生的页面文档 Loader，其实现 `core` 定义的加载端口，
按页面引用加载文档，支持取消，并在底层页面变更时通知订阅者。

#### Scenario: 按引用加载

- **WHEN** 以某页面引用调用 Loader
- **THEN** 返回该页面的文档
- **AND** 重复加载命中 Store 缓存

#### Scenario: 通知变更

- **WHEN** 已订阅的页面在 Provider 侧发生变更
- **THEN** 订阅者收到通知
- **AND** 取消订阅后不再收到通知
