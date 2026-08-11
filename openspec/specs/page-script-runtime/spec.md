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

#### Scenario: State 驱动 Computed 与绑定更新

- **WHEN** 方法执行 `state.value += 1` 且 Computed 读取该 State
- **THEN** State 与 Computed 的订阅者在同一批次看到一致的新值
- **AND** setup 函数本身不会重新执行

#### Scenario: 普通值快照不自动响应

- **WHEN** setup 返回 `{ count: state.value }` 而不是返回 State 或 Computed
- **THEN** count 保持 setup 返回时的静态值
- **AND** Runtime 不通过源码分析猜测该成员的依赖

### Requirement: Effect cleanup 与错误隔离

Effect MUST 在依赖变化重跑前执行上一次 cleanup，并在页面实例 dispose 时按反向注册顺序清理。一个
Effect、Computed 或方法抛错 MUST 只产生对应 diagnostic，不得停止其他返回成员；scheduler MUST 检出
同一 flush 中的无限自触发并暂停故障 Effect。

#### Scenario: 页面卸载清理定时器

- **WHEN** Effect 注册定时器并返回清理函数后页面实例被卸载
- **THEN** Runtime 调用清理函数并停止后续响应式通知
- **AND** 迟到回调不能重新激活已释放实例

#### Scenario: Effect 自触发超限

- **WHEN** Effect 在每次执行时无条件修改自身依赖并超过调度上限
- **THEN** Runtime 暂停该 Effect 并发布循环 diagnostic
- **AND** 同一页面的其他 State、Computed 和方法保持可用

### Requirement: 页面实例隔离与脚本重载

每个 Editor 页面、独立 Preview 和 Page Slot 渲染实例 MUST 拥有独立 setup scope；相同页面或相同脚本
资源不得隐式共享 State。setup 资源 revision 变化时 MUST dispose 旧实例并以新模块创建实例，首期 MUST
重置 State 而不是保留热更新状态。

#### Scenario: 同一页面的两个实例状态隔离

- **WHEN** 两个 Page Slot 同时渲染引用同一 setup 的页面并只在一个实例调用方法
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

