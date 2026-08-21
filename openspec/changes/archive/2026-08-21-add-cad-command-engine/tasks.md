# 任务

## 1. 命令会话协议（commands 包 Layer 2）

- [x] 1.1 `ComposeCommandPrompt` / `ComposeCommandKeyword` / `ComposeCommandInput` /
      `ComposeCommandStep` / `ComposeCommandSession` 类型
- [x] 1.2 `ComposeCommandDefinition` 与 `createComposeCommandRegistry`
- [x] 1.3 `resolveComposeCommand`：按 id 与别名不区分大小写解析
- [x] 1.4 共置单测

## 2. CAD 直线图元

- [x] 2.1 `CadLine` 与 `CadPlacement` Component 类型与读写助手
- [x] 2.2 校验扩展：图层归属可解析、端点为有限数
- [x] 2.3 `cad.entity.add` / `cad.entity.remove` 命令 handler
- [x] 2.4 共置单测

## 3. LINE 命令状态机

- [x] 3.1 纯状态机：第一点 → 循环取点 → 放弃 / 结束 / 取消
- [x] 3.2 一次执行的多条直线合并为一个 batch 事务
- [x] 3.3 共置单测（喂输入序列，不涉及 React）

## 4. cad-canvas 包

- [x] 4.1 包骨架（Layer 3，依赖 cad / commands / components / ui-context）
- [x] 4.2 SVG 画布：按图层颜色渲染直线，世界↔屏幕换算
- [x] 4.3 滚轮缩放与中键平移
- [x] 4.4 命令行：输入命令、显示提示与关键字、Esc 取消
- [x] 4.5 把指针点与键盘输入喂给命令会话，提交时派发事务
- [x] 4.6 i18n：zh-CN 与 en-US 同时补齐
- [x] 4.7 组件测试

## 5. 编辑器接线

- [x] 5.1 CAD 面板由空态换成真实画布
- [x] 5.2 Ctrl+Z / Ctrl+Shift+Z 走该标签自己的事务运行时

## 6. 验证

- [x] 6.1 `bun run lint`
- [x] 6.2 `bun run typecheck --force`
- [x] 6.3 `bun run test --force`
- [x] 6.4 `bun run build --force`
- [x] 6.5 `bun run test:e2e`，含 `L↵` → 两点 → 撤销 → 存盘重开

## 7. 实施中的发现与偏离

- [x] 7.1 **`cad-canvas` 的公共入口只导出组件**：视口换算目前没有包外消费者，导出它们会触发
      `react-refresh/only-export-components`，且属于提前暴露。步骤 6 真要用时再放出去。
- [x] 7.2 **两处 e2e 才暴露的接线漏洞**，单测都拦不住：
      - `useCadWorkspace` 创建运行时时忘了注入 `createCadCommandHandlers()`——泛型运行时不
        预置任何文档协议的内建 handler，单测因为显式传了 handlers 而正常通过。
      - CAD 面板原本渲染 `session.runtime.document`，只在 `dirty` 翻转时才换会话对象；第一次
        修改之后后续 dispatch 不再产生新会话，画布会停住。改为 `useSyncExternalStore` 订阅
        运行时。
- [x] 7.3 **SVG 在 flex 容器里不会可靠地撑满**：它有 intrinsic 尺寸（300×150），在 flex 列里
      既可能不够高也可能溢出到命令行之上，表现是画布上的点击被命令行拦截。改为
      relative 包裹层 + 绝对定位，图面的盒子才与可见区域严格一致。
- [x] 7.4 **撤销历史改为跟随活动文档标签**：`TransactionRuntime` 在 entries / canUndo / undo /
      redo / navigate 上与 `ComposeHistoryNavigationController` 结构兼容，因此 CAD 标签激活时
      直接把它接到 `resolvedHistory` 上即可，历史面板也随之显示 CAD 的撤销栈。
- [x] 7.5 测试用 `fireEvent` 而不是引入 `@testing-library/user-event`：仓库既有测试一律用前者，
      为一处测试新增 devDependency 不划算。共享 setup 没开自动 cleanup，同文件多次 render
      需要显式 `afterEach(cleanup)`。
