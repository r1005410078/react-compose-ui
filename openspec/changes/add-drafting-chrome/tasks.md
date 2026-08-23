# 任务

判别性断言先验红：断言在既有实现下必须失败，且失败原因正是本条要建立的行为。

## 1. canvas-kit · 共享十字光标

- [ ] 1.1 红：只要求十字线时不出拾取框；只要求拾取框时不出十字线
- [ ] 1.2 红：同时要求两者时，框内没有线穿过（按端点坐标断言，不看像素）
- [ ] 1.3 红：两个调用方传入不同半边长时各自按各自的画
- [ ] 1.4 绿：`packages/canvas-kit/src/crosshair/` 落地；输入只有屏幕点、两个形态布尔、
      半边长、长度百分比与 testid 前缀
- [ ] 1.5 边界用例：本包不得依赖 `@compose-ui/commands`（形态推导留在各画布）

## 2. cad-canvas · 换用共享组件

- [ ] 2.1 `Crosshair` 局部组件删除，改用共享组件；`prompt.accepts` → 两个布尔那一步留在本包
- [ ] 2.2 **既有 CAD 十字光标用例不改一行即全绿**——改了一行就说明搬运顺手改了语义
- [ ] 2.3 CAD 视觉黄金图无差异

## 3. stage · 绘图模式的十字光标

- [ ] 3.1 红：命令等待选择对象时只出拾取框（现在恒画贯穿全屏的十字线）
- [ ] 3.2 红：拾取框半边长等于 Stage 的点选容差，不是写死的数
- [ ] 3.3 红：指针落在特征点容差内时，十字中心与捕捉标记重合
- [ ] 3.4 红（e2e）：十字线绘制在场景 Entity 之上
- [ ] 3.5 绿：`StageDraftingOverlay` 改用共享组件；`cursor: none` 作用域扩到图面子树
- [ ] 3.6 Stage 视觉黄金图按需重生成，逐张确认差异只在光标

## 4. stage · 绘图命令的宿主入口

- [ ] 4.1 红：`runDraftingCommand('LINE')` 后命令行进入第一个提示
- [ ] 4.2 红：命令提交或中止后 `onDraftingCommandChange` 上报 `null`
- [ ] 4.3 红：设计模式下调用不产生任何文档事务与命令提示
- [ ] 4.4 绿：`ComposeStageHandle` 落地（与 `ComposeCanvasRulersHandle` 同形状）
- [ ] 4.5 `<StrictMode>` 组件测试：挂载→清理→再挂载后入口仍可用，且不重复启动命令

## 5. editor · 绘图工具栏

- [ ] 5.1 红：绘图模式下 toolbar 不再出现「选择」「框选」「形状」
- [ ] 5.2 红：绘图模式下点「圆」使命令行进入 `CIRCLE` 提示
- [ ] 5.3 红：命令结束后所有绘图按钮都不是按下态
- [ ] 5.4 绿：`editorMode` 经 `addDefaultElementProps` 透传（与 `shortcuts` 同一条缝）；
      `DefaultStageToolbar` 按模式分流，绘制五条与编辑三条用分割线分组
- [ ] 5.5 每个按钮有本地化 accessible name 与可见焦点态；`stageToolbar` slot 行为不变

## 6. 移除 `draw-line`

- [ ] 6.1 红：形状菜单里没有「线」条目
- [ ] 6.2 红：既有 Line Entity 照常渲染、可选中、可编辑属性（**Preset 不删**的护栏）
- [ ] 6.3 绿：`StageInteractionTool` 去掉 `'draw-line'`、`ComposeEditorShortcutAction` 去掉
      `'stage.drawLineTool'`、动作表与 i18n 条目一并删除
- [ ] 6.4 `stage-asset-drop` 仍映射得到 Line Preset；`drawing-layer` 的
      `draw-line || draw-arrow` 分支收敛成 arrow 一支
- [ ] 6.5 e2e 里用 `draw-line` 的用例改走绘图模式或改用其它形状

## 7. 门禁

- [ ] 7.1 `bun run lint`
- [ ] 7.2 `bun run typecheck`
- [ ] 7.3 `bun run test`
- [ ] 7.4 `bun run build`
- [ ] 7.5 `bun run test:e2e`
- [ ] 7.6 AGENTS.md 补记：十字光标住 canvas-kit、绘图工具栏换而不追加、只去 `draw-line` 的判据
