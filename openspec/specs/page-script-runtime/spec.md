# page-script-runtime Specification

## Purpose

定义页面 setup 脚本的运行时：加载页面关联的受信任 JavaScript 模块、调用 `setup(ctx)`、以无编译的
State/Computed/Effect 承载页面逻辑，并把返回成员作为可绑定的作用域暴露给 Stage、Preview 与 Page Slot。
每个页面渲染实例拥有独立作用域；脚本状态与函数只存在于运行时，永不写入 ComposeDocument。
## Requirements
### Requirement: 页面 setup 模块与返回作用域

系统 MUST 提供独立的页面 Script Runtime，加载页面关联的受信任 JavaScript 模块并调用其命名导出
`setup(ctx)`。setup MUST 同步返回普通对象；运行时 MUST 把 Compose State/Computed 识别为响应式值
导出，把 Function 识别为方法导出，把其他成员识别为静态值导出。导出名称 MUST 在当前页面作用域内
稳定，并且运行时不得把导出值或 Function 写入 ComposeDocument。

#### Scenario: 规范化 setup 返回成员

- **WHEN** setup 返回普通值、State、Computed 和 Function
- **THEN** Runtime 按返回 key 暴露对应的静态值、响应式值和方法成员
- **AND** State 或 Computed 后续变化只更新对应成员的当前快照

#### Scenario: 拒绝非法 setup 模块

- **WHEN** 模块缺少 setup、setup 抛错、返回 Promise 或返回非普通对象
- **THEN** Runtime 产生稳定分类的 diagnostic 且不发布部分作用域
- **AND** 页面可以继续使用文档字面 Props 渲染

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

### Requirement: 页面实例隔离与脚本重载

每个 Editor 页面与每个页面渲染实例 MUST 拥有独立 setup scope；相同页面或相同脚本
资源不得隐式共享 State。setup 资源 revision 变化时 MUST dispose 旧实例并以新模块创建实例，首期 MUST
重置 State 而不是保留热更新状态。

#### Scenario: 同一页面的两个实例状态隔离

- **WHEN** 两个渲染入口同时渲染引用同一 setup 的页面并只在一个实例调用方法
- **THEN** 只有该实例的 State 和绑定视图更新
- **AND** 另一个实例的 Effect 与方法闭包保持独立

#### Scenario: 保存脚本后重新初始化

- **WHEN** setup 文件成功保存并发布新 revision
- **THEN** Runtime 清理旧 Effect、加载新模块并从初始 State 重新建立作用域
- **AND** 加载失败时保留字面 fallback 并报告新 revision 的 diagnostic

### Requirement: 受信任 JavaScript Loader 边界

默认 Loader MUST 只执行受信任的自包含 JavaScript ESM，并 MUST 通过可替换端口允许宿主提供已编译模块。
默认 Loader MUST NOT 静默编译 TypeScript、解析 npm/相对 import 图或宣称提供安全沙箱。资源、媒体类型、
语法、CSP 与动态模块失败 MUST 归一化为 diagnostic，并在完成或取消后释放临时模块 URL。

#### Scenario: 加载自包含 JavaScript setup

- **WHEN** 页面 setup 引用解析为合法的自包含 JavaScript ESM
- **THEN** 默认 Loader 在当前 Realm 导入模块并把 setup 交给页面 Runtime
- **AND** 模块 URL 生命周期被释放且 Function 仍可由当前实例调用

#### Scenario: 默认 Loader 收到 TypeScript

- **WHEN** setup 引用解析为 TypeScript 或包含默认 Loader 无法解析的模块 import
- **THEN** Runtime 返回明确的不支持 diagnostic
- **AND** 不使用 eval、正则删类型或其他隐式转译继续执行

### Requirement: 事件方法调用语义

方法导出 MUST 只能绑定声明为 event-handler 的方法 Prop。Preview MUST 以保留 React 调用参数的 wrapper
执行方法，并捕获同步异常与 rejected Promise；方法返回值 MUST 被忽略。普通 Editor Stage MUST 保持
方法 Prop 存在但不得因选择、拖拽或普通点击执行用户方法。

#### Scenario: Preview 调用页面方法

- **WHEN** Preview 中的 React 组件触发已绑定事件 Prop
- **THEN** 对应 setup Function 收到组件传入的参数并可以修改同一页面实例的 State
- **AND** State 变化更新依赖它的 runtime Props

#### Scenario: 方法调用失败

- **WHEN** 已绑定方法同步抛错或返回 rejected Promise
- **THEN** Runtime 发布方法 diagnostic 且 Preview 其他 Entity 继续工作
- **AND** 方法错误不进入 ComposeDocument 事务或撤销历史

### Requirement: 动画播放控制的脚本驱动语义

绑定到页面 setup 导出的动画播放控制 MUST 遵守以下语义。`playing` 绑定 MUST 读取布尔导出：
从 `false` 变为 `true` 的上升沿 MUST 先把播放头复位到 `0` 再按动画的 `playbackMode` 推进；
从 `true` 变为 `false` MUST 停止推进并把播放头停在当前帧。`currentTime` 绑定 MUST 读取数值导出，
存在时脚本完全接管时间轴：播放头 MUST 等于该导出的值钳制到 `[0, durationMs]`，
运行时 MUST NOT 自行推进，`playing` 与 `playbackMode` MUST 被忽略。
订阅 MUST 使用 `subscribeExport` 的单导出粒度，MUST NOT 订阅整个作用域。

#### Scenario: 上升沿从头播放

- **WHEN** 绑定的布尔导出从 `false` 变为 `true`
- **THEN** 播放头复位到 `0` 并开始推进

#### Scenario: 重新触发可重播

- **WHEN** 一条 `play-once` 动画播放到末尾后，绑定的布尔导出被置为 `false` 再置为 `true`
- **THEN** 动画从 `0` 重新播放一次

#### Scenario: 下降沿停在当前帧

- **WHEN** 动画播到 180 ms 时绑定的布尔导出变为 `false`
- **THEN** 推进停止，画面保持在 180 ms 的采样结果

#### Scenario: 脚本接管时间轴

- **WHEN** 动画绑定了 `currentTime` 且该数值导出的值为 150
- **THEN** 播放头为 150 ms，运行时不自行推进
- **AND** 即使 `playing` 也有绑定且为 `true`，也不改变这一行为

#### Scenario: 当前时间越界被钳制

- **WHEN** 绑定的数值导出给出负数或大于 `durationMs` 的值
- **THEN** 播放头钳制到 `0` 或 `durationMs`

### Requirement: 播放控制绑定的失效处理

绑定的导出不存在、已被脚本热重载移除，或类型与目标语义不符时，运行时 MUST 按未绑定处理，
MUST NOT 抛出异常或猜测类型转换，并 MUST 通过 `reportDiagnostic` 报告一条可定位的诊断。
运行时 MUST NOT 因为绑定失效而修改文档中已保存的绑定。

#### Scenario: 绑定到不存在的导出

- **WHEN** `bindings.playing` 指向一个页面 setup 没有导出的名称
- **THEN** 动画不播放，页面正常渲染，并产生一条诊断

#### Scenario: 类型不匹配

- **WHEN** `bindings.playing` 指向一个字符串导出
- **THEN** 动画不播放，不做真值转换，并产生一条诊断

#### Scenario: 热重载后导出消失不清除绑定

- **WHEN** 用户编辑 setup 脚本删掉了被绑定的导出
- **THEN** 文档中的绑定保持不变，只产生诊断
- **WHEN** 用户把该导出改回来
- **THEN** 动画恢复受控，不需要重新绑定

### Requirement: 脚本导航逃生舱

`createComposePageScriptScope` MUST 接受宿主注入的可选导航端口,并在注入后于 setup 上下文
暴露 `navigate` 与 `navigateBack`。两者 MUST 直接委托给同一个导航端口——声明式 `Interaction`
与脚本调用 MUST NOT 各自维护一份当前页面或返回栈。

未注入导航端口时 `ctx.navigate` MUST 存在但调用即产生可判别的脚本 diagnostic,MUST NOT
抛出未捕获异常中断整个 setup。`@compose-ui/script-runtime` MUST 只依赖 `core` 的端口类型,
MUST NOT 依赖 `@compose-ui/pages` 或任何渲染包。

在 setup 同步执行期间调用导航 MUST 产生 diagnostic 并被忽略——页面尚未挂载完成时跳转会让
当前页的 effect cleanup 与新页的 setup 交错。

#### Scenario: 脚本条件跳转

- **WHEN** 宿主注入导航端口,页面方法在被事件调用时按条件调用 `ctx.navigate`
- **THEN** 导航端口收到跳转请求且当前页面切换
- **AND** 跳转与声明式 `Interaction` 共享同一个返回栈

#### Scenario: 未注入端口

- **WHEN** 宿主未注入导航端口且脚本调用 `ctx.navigate`
- **THEN** Runtime 发布可判别的 diagnostic
- **AND** setup 的其余部分继续正常工作

#### Scenario: setup 期间调用被拒绝

- **WHEN** setup 函数在同步执行过程中直接调用 `ctx.navigate`
- **THEN** 该次调用被忽略并发布 diagnostic
- **AND** 页面仍然完成 setup 并暴露其返回成员

