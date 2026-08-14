# 任务

## 1. OpenSpec 与协议基座

- [ ] 1.1 验证 compose-document、component-registry 增量规范，并建立 Scenario 到测试的映射清单。

## 2. Core Bindings v1/v2

- [ ] 2.1 Red → Green → Refactor：扩展 Bindings 校验，覆盖 v1 原样解析、v2 双分区、`rendererProps`
      的 Renderer 前置条件、`componentFields` 的 Component 存在性、空 Component 拒绝与精确 issue 路径。
- [ ] 2.2 Red → Green → Refactor：实现序列化往返与 v1→v2 写入规范化（仅首次保存 Component 字段绑定
      时改写 version），验证加载旧文档不改写。
- [ ] 2.3 Red → Green → Refactor：实现绑定写入/删除命令，覆盖解绑最后一项时删除 Bindings、移除
      Component 时在同一事务清理其字段绑定。

## 3. Registry Field Contract 与运行时

- [ ] 3.1 Red → Green → Refactor：实现 Field Contract 注册与校验（空名、重名、kind 声明）。
- [ ] 3.2 Red → Green → Refactor：实现 authored/runtime 值解析、页面 scope 订阅、getter/validator
      异常隔离与 diagnostic，验证与 Renderer Props 解析互不影响。

## 4. Inspector 绑定端口

- [ ] 4.1 Red → Green → Refactor：实现 React bridge binding port（兼容变量、当前引用、状态、
      绑定/换绑/解绑意图），验证无 Script Scope 时降级为纯 authored 编辑。
- [ ] 4.2 Red → Green → Refactor：在 Editor Inspector 接入 Component 字段绑定入口，复用既有 Renderer
      绑定交互与可访问性语义。

## 5. 验证与交付

- [ ] 5.1 为每个任务在本文件记录实际 Red command/result/reason、Green command/result 与
      Regression command/result。
- [ ] 5.2 运行 `openspec validate add-component-field-binding --strict`。
- [ ] 5.3 运行 `bun run lint`、`bun run typecheck`、`bun run test`、`bun run build` 与
      `bun run test:e2e`，修复全部回归后更新完成状态。
