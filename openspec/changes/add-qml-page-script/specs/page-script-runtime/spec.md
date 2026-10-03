## ADDED Requirements

### Requirement: 可移植响应式运行时产物

`@compose-ui/script-runtime` MUST 额外产出一个自包含 ES 模块，包含页面作用域与响应式原语，
且在模块求值与 setup 执行过程中 MUST NOT 引用任何浏览器全局（`window`、`document`、`Blob`、`URL`
等）。该产物 MUST 与浏览器端共用同一份源码，MUST NOT 维护第二份实现。

#### Scenario: 在非浏览器引擎中求值

- **WHEN** 在不提供任何浏览器全局的 JavaScript 引擎中 import 该产物并以一个 setup 创建作用域
- **THEN** 作用域正常创建，导出快照与浏览器端相同

#### Scenario: 源码变更同步到产物

- **WHEN** 修改 `reactivity` 或 `scope` 的实现并重新构建
- **THEN** 浏览器端与可移植产物同时反映该修改

### Requirement: 可移植脚本 API 声明

`@compose-ui/script-runtime` MUST 公开可移植全局对象清单与不可移植浏览器全局清单，可移植清单 MUST 与
Qt 运行时实际补齐的全局一致；文档中 MUST 写明 `fetch` 子集与浏览器行为的差异。

#### Scenario: 清单与注入一致

- **WHEN** 运行可移植 API 一致性校验
- **THEN** 可移植清单中的每个全局都在 Qt 运行时补齐清单中，反之亦然
