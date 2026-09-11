## 1. core：屏幕尺寸吸附与宽高比

- [x] 1.1 把 `DEFAULT_SNAP_RADIUS` 从 `stage` 下沉为 core 的 `COMPOSE_SNAP_RADIUS`，`stage` 改为导入
- [x] 1.2 新增 `formatComposeAspectRatio`：常见比例查表（含容差与 `~` 前缀），落表外退回最简分数或小数
- [x] 1.3 新增 `snapComposeScreenSize`：优先级严格先于距离、容差按屏幕距离折算、粒度是整份分辨率
- [x] 1.4 Vitest 钉住四条：优先目标尺寸、缩放折算容差、宽命中高不命中不吸、未命中返回 `null`

## 2. preview：`fit` 真正缩放

- [x] 2.1 `ComposePreview` 的 `fit` 改用 `transform: scale()`，`transform-origin` 由 `alignment` 决定
- [x] 2.2 Testing Library 钉住：`contain` 下 Frame 与后代同比缩放，布局结果与 `none` 一致

## 3. 预览对话框：保真

- [x] 3.1 画板去掉强制白底、圆角裁切与白色外圈；透明处画棋盘
- [x] 3.2 CSS `zoom` 换成 `transform: scale()`
- [x] 3.3 视图缩放控件：减 / 读数 / 加 / 适应窗口（动作），滚轮与 `Ctrl+0`
- [x] 3.4 删掉 `__target` 那套针对 `button[aria-pressed]` 的死 CSS 与失效文案

## 4. 预览对话框：屏幕尺寸

- [x] 4.1 屏幕尺寸会话状态：默认等于目标 `Frame.size`，目标切换时跟随
- [x] 4.2 菜单：第一组目标自身尺寸（查不到通名即标自定义）、第二组清单、输入尺寸、横竖互换
- [x] 4.3 `targetKind` prop 与四处分流：第一组标题、默认 `fit`、横竖互换是否出现、第二组标题
- [x] 4.4 画板右下角拖拽改屏幕尺寸，接 `snapComposeScreenSize`，命中时读数转命中态
- [x] 4.5 尺寸胶囊读数：等于目标尺寸时写原尺寸 · 1:1，不等时写映射关系

## 5. 缺陷

- [x] 5.1 场景选择器的名称改从当前预览的文档取（F6）
- [x] 5.2 跳转中不再把上一页的 `frameId` 当显式目标传下去（F7）
- [x] 5.3 宿主只在画布上正是那一页时提供导航端口与 live 页（F10），并在 TSDoc 写明契约
- [x] 5.4 组件测试钉住 F6、F7、F10 各一条

## 6. 文案与公共 API

- [x] 6.1 `ComposePreviewDialogMessages` 用 `screenSize` / `zoom` 组替换 `scale`
- [x] 6.2 新增导出的 TSDoc 齐备；`app` 的中文文案同步
- [x] 6.3 设计稿 `docs/mockups/preview-redesign.html` 随变更入库

## 7. 验证

- [x] 7.1 `bun run lint`
- [x] 7.2 `bun run typecheck`
- [x] 7.3 `bun run test`
- [x] 7.4 `bun run build`
- [x] 7.5 `bun run test:e2e`
