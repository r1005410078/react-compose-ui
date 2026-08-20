## ADDED Requirements

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
