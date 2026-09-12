# 任务

## 1. 第 6 步：抽 `ComposePreviewSurface`（纯重构，行为逐条不变）

- [x] 1.1 新建 `packages/preview/src/preview-surface/`，把目标解析（页面/文档两模、场景列表、
      显式目标不回退）从 `compose-preview-dialog.tsx` 搬进 `use-preview-surface.ts`
- [x] 1.2 屏幕（尺寸、`fit`、拖角吸附）与视图（缩放、取景、`Ctrl+0`）一并搬进同一个 Hook
- [x] 1.3 播放会话（播放头、播放模式、rAF 生命周期、手动接管）搬进同一个 Hook
- [x] 1.4 新建 `compose-preview-surface.tsx`：只画台面、画板、屏幕与 `ComposePreview` /
      `ComposePageHost`，不含任何 chrome
- [x] 1.5 `compose-preview-dialog.tsx` 改成「Hook + Surface + 模态 chrome」
- [x] 1.6 **`preview-surface` 不进 `src/index.tsx`**；边界用例断言它不在公共导出里
- [x] 1.7 验收：`bun run --cwd packages/preview test` 69 条全绿且**一条都不改写**——
      需要改写用例即说明行为变了，那不是这一步该做的事

## 2. 第 7 步：`ComposePreviewPage`

- [x] 2.1 屏幕尺寸模式从「一个尺寸值」改成 `{ kind: 'viewport' } | { kind: 'fixed', size }`，
      弹框固定用 `fixed`（默认目标尺寸），行为不变
- [x] 2.2 新建 `packages/preview/src/preview-page/`：Surface 铺满视口，默认 `viewport` 模式 + 视图 1:1
- [x] 2.3 `viewport` 模式跟随窗口尺寸变化（复用 `useComposeHostBoxSize`），读数写「实际屏幕」
- [x] 2.4 挑固定分辨率时在真视口里套出那块屏，四周留黑
- [x] 2.5 控制条：退出、场景选择、屏幕尺寸、宽高、互换、浏览器全屏；**不含时间轴**
- [x] 2.6 静息自动隐藏：指针移动浮出、停两秒隐去；**焦点在控制条内时恒可见**，`Tab` 可唤出
- [x] 2.7 `Escape` 与控制条上的退出都发 `onRequestExit`
- [x] 2.8 `ComposePreviewPage` 与它的 props 进 `src/index.tsx` 公共入口，补 TSDoc

## 3. 第 7 步：两个形态之间的桥

- [x] 3.1 `ComposePreviewDialog` 新增可选 `onRequestFullscreen(state)`，载荷是
      `{ frameId, screen, playheadMs }`；不传时不画那颗按钮
- [x] 3.2 `ComposePreviewDialog` 新增可选 `secondaryActions`，放在关闭那一组之前
- [x] 3.3 `ComposePreviewPage` 接受 `initialState` 把这三样还原
- [x] 3.4 新增文案键并补进 `DEFAULT_MESSAGES`

## 4. 示例应用接线

- [x] 4.1 预览路由：`history.pushState` 进入、`popstate` 退出，**编辑器不卸载**
- [x] 4.2 弹框上接「整屏预览」，退出时把状态还原回弹框
- [x] 4.3 次级动作插槽已就位；**示例应用不提供那颗按钮**——它的 Provider 是内存实现
      （`demo-memory`），新标签页拿到的是重新播种的空白会话，接上等于给一颗必然显示错内容
      的控件。有持久化 Provider 的宿主接 `secondaryActions` 即可
- [x] 4.4 中文文案补齐

## 5. 测试

- [x] 5.1 Vitest / Testing Library：默认真像素、视口跟随、挑小屏留黑
- [x] 5.2 控制条静息隐去与**键盘唤出**（判别性：只按指针显隐时该用例必须红）
- [x] 5.3 两个形态同输入同输出
- [x] 5.4 桥：不传动作不画控件；请求载荷带三样；还原回原状态
- [x] 5.5 边界用例：共同实现不在公共导出里
- [x] 5.6 e2e：进整屏 → 真实跳转 → `Escape` 回编辑器，选区与撤销栈不变

## 6. 验证

- [ ] 6.1 `bun run lint` / `typecheck` / `test` / `build`
- [ ] 6.2 `bun run test:e2e`，与 main 逐条对比既有失败
- [ ] 6.3 `openspec validate add-preview-fullscreen-page --strict`
- [ ] 6.4 设计稿第 08 节的琥珀虚线圈按落地情况收掉
