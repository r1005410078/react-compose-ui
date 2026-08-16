# 设计说明

## Effect 熔断为什么按 flush 复位

原实现把 `paused` 置位后永不复位，`run` 与 `schedule` 都硬 return，且熔断时还调用了
`removeDependencies` 抹掉依赖订阅。两者叠加的结果是：一次误判即永久失活，用户除了改脚本触发
重新加载之外没有任何恢复手段，而 `script.effect-cycle` 的文案完全没有表达这层不可逆性。

调度上限本质上是「单轮刷新内的收敛保护」，不是对 Effect 的永久判决。改为按 flush 复位后：

- 合法突发（例如初始化时批量写入超过上限）只损失本轮的后续执行，下一轮恢复正常。
- 真正的死循环每轮仍被截断，并且每轮都发布 diagnostic，可观测性反而更强。

因此熔断时不能再 `removeDependencies`——复位后需要依赖订阅才能重新被调度。

考虑过的替代方案：保持永久失活但在 `ComposePageScriptScope` 上暴露 `resumeEffects()`，由
Editor 面板提供「恢复」按钮。它需要同时扩张 Runtime 公共 API 与 Editor UI，而按 flush 复位
已经覆盖了误判场景，收益不成比例。

## 为什么密封 setup 阶段而不是引入 owner 树

`createComputed` 与 `createEffect` 分别向实例的 `observers`/`effects` 追加且没有注销路径。在
Effect 内部创建响应式原语时，每次重跑都会新增一份，旧的仍订阅依赖并继续执行。

正确的通用解法是 Solid 式 owner 树：Effect 重跑前先释放上一次执行期间创建的子作用域。但这会
改写整个所有权模型，而现有规范里没有任何嵌套响应式作用域的故事，也没有真实用例驱动。

首期选择显式限制：setup 返回后密封 context，三个原语发布 `script.context-after-setup` 诊断并
返回降级对象。降级对象保持可调用形状（`state` 返回普通可读写 Cell、`computed` 返回不跟踪的惰性
求值、`effect` 不注册），这样误用不会让用户脚本直接抛错，而是变成一条可见诊断。出现真实的
嵌套作用域用例时再单独提案引入 owner 树。

## Computed 错误状态的恢复路径

抛错时保持 `dirty = false` 是刻意的：`.value` 可能在一次渲染中被读取多次，若保持 dirty 则每次
读取都会重新执行并重复发布同一条 diagnostic。

恢复依赖既有的 `schedule()`：抛错点之前已经跟踪到的依赖发生变化时会把 `dirty` 置回 true，
下次读取即重算。抛错点之后的依赖确实丢失了——这是无编译运行时里追踪部分执行的固有限制，
用一次成功求值即可补齐，不值得为此引入依赖预扫描。

## 共享加载 Hook 的归属

`preview` 与 `materials` 都需要这段逻辑，但两者之间不允许有依赖边，而 `script-runtime` 必须
保持无 React。`component-registry` 是唯一同时满足条件的位置：已经依赖 `script-runtime` 与
`assets`、以 React 为 peer dependency、且同时被 `preview` 和 `materials` 依赖，抽取不产生任何
新的依赖边。

这会把 `component-registry` 的职责从「实例级宿主组件注册与 Renderer measurement adapter」略微
扩展到「页面脚本作用域加载」，需要同步更新 `AGENTS.md` 的架构边界描述。
