# @compose-ui/script-runtime

与 React、DOM 和 Editor 无关的页面 setup 运行时。它提供无源码转换的 `state`、`computed`、
`effect`，把 setup 同步返回的普通对象规范化为页面实例作用域，并通过可替换 Loader 加载受信任的
自包含 JavaScript ESM。

脚本与宿主运行在同一 Realm，拥有宿主的浏览器权限；本包不是安全沙箱，也不编译 TypeScript 或解析
npm/相对模块图。

公共常量 `COMPOSE_PAGE_SCRIPT_TYPE_DECLARATIONS` 是编辑器使用的 Context、State、Computed 与 Setup
`.d.ts` 契约。它只供 JavaScript Language Service 分析，不参与源码加载、转换或 Runtime 执行。

```js
export function setup(ctx) {
  const num = ctx.state(0)
  const onAdd = () => { num.value += 1 }
  return { num, onAdd }
}
```

编辑器中的 `ctx.` 补全会显示中文说明和示例：

- `ctx.state(initial)` 创建可读写 State，并从初始值推导 `.value` 类型。
- `ctx.computed(read)` 创建自动跟踪依赖的只读派生值。
- `ctx.effect(run)` 立即运行并跟踪依赖；`run` 可以返回页面卸载或重新执行前调用的 cleanup。

这些示例以 Markdown JavaScript fenced code block 传给 Monaco，详情面板会按当前编辑器主题
显示语法着色，并随内容自动调整高度；用户仍可拖动详情面板边缘调整尺寸。

## 边界

- 只依赖 `@compose-ui/core` 的页面引用协议与 `@compose-ui/assets` 的 Resolver 端口。
- 不依赖 React、Editor、Stage、Preview 或 Property Panel。
- State/Function 永不写入 `ComposeDocument`；文档只保存稳定的 `Bindings` 引用。
