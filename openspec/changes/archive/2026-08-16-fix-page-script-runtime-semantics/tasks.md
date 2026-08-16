# 任务

## 1. Renderer method 绑定回退（正确性）

- [x] 1.1 在 `runtime-props.test.ts` 增加红测：authored Props 含同名字面值时 method 绑定缺失导出仍得到 `undefined`
- [x] 1.2 去掉 `runtime-props.ts` 两处 `&& !(propName in props)` 守卫
- [x] 1.3 把 `methodMode === 'noop'` 的 wrapper 提升为模块级常量，避免每次渲染产生新引用

## 2. Effect 熔断按 flush 复位

- [x] 2.1 红测：Effect 在某轮超限后，下一轮依赖变化时重新执行
- [x] 2.2 `flush()` 复位上一轮遗留的 `paused`，熔断时不再 `removeDependencies`
- [x] 2.3 更新 `script.effect-cycle` 诊断文案为「本轮刷新已中止」

## 3. 密封 setup 阶段

- [x] 3.1 红测：setup 返回后调用 `ctx.effect`/`ctx.computed` 产出诊断且实例 Effect 数量不增长
- [x] 3.2 `types.ts` 增加 `script.context-after-setup` 诊断码
- [x] 3.3 `ComposeReactiveOwner` 增加 `seal()`，密封后三个原语返回降级对象并发布诊断
- [x] 3.4 `scope.ts` 在导出跟踪 Effect 建立完毕后调用 `seal()`
- [x] 3.5 同步 `type-declarations.ts` 的 context 注释并确认 `type-declarations.test.ts` 通过

## 4. Computed 抛错语义

- [x] 4.1 红测：抛错后 `.value` 为 `undefined`，依赖修复后恢复
- [x] 4.2 `createComputed` 增加 `errored` 标记并在成功求值时清除

## 5. 无变更不通知

- [x] 5.1 红测：只写入未导出的私有 State 时 `subscribe` 监听者不被唤醒
- [x] 5.2 `notify()` 在 `changedExports` 为空时早返回

## 6. 共享脚本作用域加载 Hook

- [x] 6.1 新建 `component-registry/src/page-script-scope/`，实现 `useComposePageScriptScope` 与共置测试
- [x] 6.2 从 `component-registry` 公共入口导出 Hook 与其选项类型
- [x] 6.3 `preview` 改为消费该 Hook，删除 `useComposePreviewPageScope`
- [x] 6.4 `materials` Page Slot 改为消费该 Hook，删除 `useNestedPageScriptScope`
- [x] 6.5 更新 `AGENTS.md` 中 `@compose-ui/component-registry` 的架构边界描述

## 7. 加载器注释与取消语义

- [x] 7.1 `module-loader.ts` 在 revoke 处补充自包含约束注释
- [x] 7.2 `loadComposePageScriptScope` TSDoc 写明本函数永不 reject 及调用方的 dispose 责任
- [x] 7.3 `use-page-workspace.ts` 的 `openPage` 与 `setPageSetupScript` 接入 `reloadControllersRef` 取消模型

## 8. 验证

- [x] 8.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 8.2 `bun run test:e2e`
- [x] 8.3 `openspec validate fix-page-script-runtime-semantics --strict`
