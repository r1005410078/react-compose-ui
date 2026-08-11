# 变更：修正页面脚本运行时的错误语义与绑定回退

## Why

对 `@compose-ui/script-runtime` 及其在 `component-registry`、`preview`、`materials`、`editor`
的接入做代码评审后，发现既有实现与 `page-script-runtime`、`component-registry` 规范的
承诺存在偏差，且部分错误路径不可恢复：

- Renderer method 绑定失败时，authored JSON 字面值会作为回调传给宿主组件。规范只为
  **value** 绑定定义了「回退字面 Prop」，method 绑定没有合法回退——JSON 值永远不是函数，
  宿主组件调用它就会崩溃。
- Effect 一次触发调度上限即永久失活，本页面实例生命周期内没有任何恢复路径。一次合法的
  初始化突发就能让 Effect 彻底停止，而诊断文案没有表达这是不可逆的。
- Computed 抛错后保留上一次的结果，消费者拿到看起来正常、实际已过期的值；同时依赖集合在
  抛错点被截断，错误状态会永久粘住。
- `state`/`computed`/`effect` 没有阶段限制。在 Effect 内部创建 Computed 或 Effect 会让
  observer 与 effect 列表只增不减、旧 Effect 继续执行，形成无界增长。
- 脚本内部纯私有 State 的写入会唤醒全部作用域订阅者，与「精确刷新依赖 Entity」的既有承诺不符。
- Preview 与 Page Slot 各自复制了同一份约 50 行的脚本加载/热重载/dispose 竞态 Hook，
  规范要求的取消与清理语义存在两份独立实现。

## What Changes

- **BREAKING**：method 绑定解析失败时 runtime prop 一律为 `undefined`，不再回退同名 authored
  字面值。value 绑定的回退语义不变。
- Effect 调度熔断从「永久暂停」改为「按 flush 复位」：超限只中止本轮刷新并发布循环 diagnostic，
  下一轮刷新重新参与调度。真正的死循环每轮仍被截断并持续告警。
- Computed 抛错后当前值为 `undefined` 而不是陈旧结果；成功重算后自动恢复。
- `ctx.state`、`ctx.computed`、`ctx.effect` 限定在 setup 同步阶段调用。此后调用发布新诊断码
  `script.context-after-setup` 并返回非响应式降级对象，不再注册到实例。
- 作用域在没有任何导出成员变化时不发布快照通知；诊断通知路径不变。
- 新增 `@compose-ui/component-registry` 公共 Hook `useComposePageScriptScope`，统一承载页面
  setup 脚本的加载、资源热重载订阅、卸载 dispose 与 abort 竞态；`preview` 与 `materials`
  的 Page Slot 改为消费它。

## 首期边界

- 不引入 Solid 式 owner 树来支持嵌套响应式作用域。setup 之外创建响应式原语先以显式限制加
  诊断收口；出现真实用例时再单独提案。
- 不为熔断的 Effect 提供手动恢复入口，按 flush 复位已覆盖误判场景。
- 不改变默认 Loader 的受信任、自包含 JavaScript 边界。
