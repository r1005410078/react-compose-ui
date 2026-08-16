## MODIFIED Requirements

### Requirement: 无编译的响应式原语

`ctx.state(initial)` MUST 返回以 `.value` 读写的响应式 Cell，`ctx.computed(read)` MUST 返回只读
Computed，`ctx.effect(run)` MUST 立即运行并跟踪执行期间读取的依赖。State MUST 以 `Object.is` 判定变化，
同一调用栈写入 MUST 在 microtask 中合并通知；系统 MUST NOT 要求或执行源码赋值转换。

三个原语 MUST 只在 setup 同步执行期间可用。setup 返回后再调用 MUST 发布稳定分类的 diagnostic 并返回
不参与依赖跟踪的降级对象，MUST NOT 把新 Computed 或 Effect 注册到页面实例——否则在 Effect 内部创建
响应式原语会让实例持有的 observer 与 Effect 只增不减且旧 Effect 继续执行。

一次刷新 MUST 只在存在实际变化的导出成员时发布作用域快照通知；脚本内部未导出 State 的写入
MUST NOT 唤醒作用域订阅者。

#### Scenario: State 驱动 Computed 与绑定更新

- **WHEN** 方法执行 `state.value += 1` 且 Computed 读取该 State
- **THEN** State 与 Computed 的订阅者在同一批次看到一致的新值
- **AND** setup 函数本身不会重新执行

#### Scenario: 普通值快照不自动响应

- **WHEN** setup 返回 `{ count: state.value }` 而不是返回 State 或 Computed
- **THEN** count 保持 setup 返回时的静态值
- **AND** Runtime 不通过源码分析猜测该成员的依赖

#### Scenario: setup 之外创建响应式原语

- **WHEN** 已导出的方法或 Effect 在 setup 返回后调用 `ctx.effect` 或 `ctx.computed`
- **THEN** Runtime 发布 setup 阶段外调用的 diagnostic 并返回不跟踪依赖的降级对象
- **AND** 页面实例持有的 Effect 与 observer 数量不增长，既有成员保持可用

#### Scenario: 私有 State 写入不通知作用域

- **WHEN** 方法只修改一个没有出现在 setup 返回对象中的 State
- **THEN** 作用域订阅者不收到快照通知
- **AND** 依赖该 State 的 Computed 导出若因此变化仍然精确通知其订阅者

### Requirement: Effect cleanup 与错误隔离

Effect MUST 在依赖变化重跑前执行上一次 cleanup，并在页面实例 dispose 时按反向注册顺序清理。一个
Effect、Computed 或方法抛错 MUST 只产生对应 diagnostic，不得停止其他返回成员。

scheduler MUST 检出同一 flush 中的无限自触发并中止该 Effect 在本轮刷新中的继续执行，同时发布循环
diagnostic。熔断 MUST 按 flush 复位：下一轮刷新中该 Effect 重新参与调度并保留其依赖订阅，因此一次
合法的突发不会永久停用 Effect，而真正的死循环每轮仍被截断并持续告警。

Computed 的读取函数抛错时，Runtime MUST 发布 diagnostic 且当前值 MUST 为 `undefined`，MUST NOT 返回
上一次成功计算的陈旧结果。抛错前已跟踪到的依赖变化 MUST 能触发重算，成功重算后 MUST 清除错误状态。

#### Scenario: 页面卸载清理定时器

- **WHEN** Effect 注册定时器并返回清理函数后页面实例被卸载
- **THEN** Runtime 调用清理函数并停止后续响应式通知
- **AND** 迟到回调不能重新激活已释放实例

#### Scenario: Effect 自触发超限

- **WHEN** Effect 在每次执行时无条件修改自身依赖并超过调度上限
- **THEN** Runtime 中止该 Effect 在本轮刷新中的继续执行并发布循环 diagnostic
- **AND** 同一页面的其他 State、Computed 和方法保持可用

#### Scenario: 熔断的 Effect 在下一轮刷新恢复

- **WHEN** 一个 Effect 在某轮刷新中超过调度上限，随后其依赖在新的一轮刷新中变化
- **THEN** 该 Effect 重新执行并应用最新依赖值
- **AND** 若自触发仍未收敛则本轮再次被截断并再次发布循环 diagnostic

#### Scenario: Computed 抛错不返回陈旧值

- **WHEN** Computed 的读取函数在依赖变化后抛错，而它此前已成功计算过一个值
- **THEN** Runtime 发布 Computed diagnostic 且该成员当前值为 `undefined`
- **AND** 依赖修复后重算成功时该成员恢复正常取值
