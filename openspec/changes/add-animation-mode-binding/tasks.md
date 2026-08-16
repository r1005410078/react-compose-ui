## 1. property-panel 装饰插槽

- [x] 1.1 Red：为语义 editor、自定义 renderer 与基础 primitive 三种字段上的装饰渲染、
  装饰不挤占动作栏、未提供插槽时不渲染容器写测试。
- [x] 1.2 Green：给 `ComposePropertyPanelProps` 增加 `renderFieldAdornment`，
  用 context 下传，接线 `property-tree.tsx` 的四个标签渲染点
  （renderer 分支两处、`PropertyRow`、`PrimitiveField`）。
- [x] 1.3 `StandaloneComposePropertyPanel` 与 `EmbeddedComposePropertyPanel` 两条 plumbing 都接。
- [x] 1.4 把 `data-property-part="adornment"` 写进 `src/index.tsx` 的稳定契约清单与 TSDoc。

## 2. animation-panel 基础改造（吸收 update-animation-panel-foundation）

- [x] 2.1 Red：light 主题下关键前景色的双主题 Story 与断言。
- [x] 2.2 Green：`styles.css` 硬编码前景色全部换成 `--compose-*` token。
- [x] 2.3 Red：多轨道各自渲染片段、选择片段联动轨道的模型与组件测试。
- [x] 2.4 Green：`ComposeAnimationClip.trackId` 改必填，删除 label / ID 前缀启发式。
- [x] 2.5 Green：删除 `displayTrackLabel` / `displayPropertyLabel` 白名单与内置演示文案。
- [x] 2.6 已由 `add-animation-timeline-zoom` 落地：`board-scroll` 已是唯一纵向滚动容器，
  左列 `overflow: visible`、右列 `overflow-y: clip`。补了一条结构回归测试守住这个前提；
  真实布局对齐由 Playwright 覆盖，jsdom 不做布局。
- [x] 2.7 无需重排：结构已符合要求，见 2.6。
- [x] 2.8a 给 `package.json` 增加 `@compose-ui/components` 依赖并在 vite 外置。
- [x] 2.8b 数值输入改用共享 Primitive：给 `ComposeInput` 补 `size: default | sm | xs` 变体
  （对齐 `ComposeButton` 已有做法），`CommittedInput` 保留草稿/提交状态机但渲染委托给它。
- [x] 2.8c 图标按钮、播放模式与轨道动作按钮改用 `ComposeButton variant="ghost" size="icon-xs"`；
  面板样式表补 `@import '@compose-ui/components/styles.css'`（dist JS 不携带 CSS），
  删除会压过 layered 工具类的无 layer chrome 规则，保留尺寸覆盖、SVG 描边与状态色。
- [x] 2.8d 颜色字段改用 `ComposeColorPicker`（等第 3 节 `valueKind` 落地后一起做，
  届时颜色控件只在 `valueKind === 'color'` 的轨道上出现）。
- [ ] 2.8e 轨道与属性行的"更多操作"菜单——**阻塞于产品决策，非技术依赖**：菜单应提供哪些
  具体动作从未定义，未定义动作前无法写 Scenario，也无法实现。该开放问题最初记录在
  `update-animation-panel-foundation` 的 design.md，那份变更已随本提案吸收执行而归档
  （见 `openspec/changes/archive/2026-08-16-update-animation-panel-foundation/`，其 4.3 即本条），
  因此这里是该问题目前唯一的在途承载点，不要再回指归档目录等待。

## 3. animation-panel 数据模型与动作回调

- [x] 3.1 Red：数值轨道显示数值输入、二维向量轨道显示两个分量、cubic 控制点可编辑的组件测试。
- [x] 3.2 Green：`ComposeAnimationKeyframe.value` 放宽为数值 / 二维向量 / 颜色；
  `interpolation` 改为 `hold` / `linear` / `cubic` 判别联合；
  `ComposeAnimationPropertyTrack` 增加 `valueKind`；Inspector 按 `valueKind` 分派值控件。
- [x] 3.3 Red：拖动关键帧产生移动动作、播放只产生播放头动作的测试。
- [x] 3.4 Green：新增 `onAction` 与 `ComposeAnimationPanelAction` 联合，在 provider 的每个
  session 方法里发出对应动作。
- [x] 3.5 Red/Green：空会话状态——不含轨道时渲染宿主提供的空状态内容，
  受控空值不回退到演示数据；新增对应的空状态插槽属性。
- [x] 3.6 更新 `createDefaultComposeAnimationPanelValue`、Storybook 夹具与
  `apps/storybook/src/public-api-contracts.ts`。

## 4. editor 动画模式

- [x] 4.1 新建 `packages/editor/src/animation-mode/animation-mode-state.ts`：
  `active` 由底部动画标签是否活动派生，会话状态含 `animationId`、`playheadMs`、
  `isPlaying`、`autoRecord`、选择。播放头单独用一个 context 暴露，避免整个 controller 重渲。
- [x] 4.2 Red：`animation-document-adapter` 的纯函数测试——文档动画 → 面板会话值
  （对象轨道取 Entity 名称、vector2 展开成两行共享 `propertyId`）与反向的动作 → 命令翻译。
- [x] 4.3 Green：实现 `animation-document-adapter.ts`。
- [x] 4.4 Red：`animation-key-state.ts` 的四态测试，含 `flow` 定位与 `fill`/`hug` 尺寸的
  `unavailable`。
- [x] 4.5 Green：实现 `animation-key-state.ts` 与 `animation-key-button.tsx`
  （本地化 accessible name、禁用态说明原因）。
- [x] 4.6 Green：`use-animated-document.ts` —— 动画模式下用 `@compose-ui/animation` 的
  `applyComposeAnimationAtTime` 派生文档喂给 Stage / LayoutRuntime / Preview，
  dispatch 保持指向基础文档。
- [x] 4.7 接线：`entity-inspector.tsx` 按 section 的 `componentKey` 把相对 `PropertyPath`
  拼成 Entity 内路径后交给 `renderFieldAdornment`，只在白名单路径上渲染菱形；
  `controller.tsx` 注入插槽；`workspace-panels.tsx` 的 `AnimationPanel` 改为受控；
  `compose-editor.tsx` 的 `ComposeAnimationPanelProvider` 从零 props 改为受控。
- [x] 4.8 Red/Green：空状态与创建引导——无动画时渲染引导，触发创建派发
  `animation.create` 并自动选中新动画，撤销回到空状态。
- [x] 4.9 新增编辑器 i18n 文案：菱形四态、动画模式提示、自动记录、空状态与创建引导。

## 5. 自动记录

- [x] 5.1 先确认 `entity.transform.set` 各 `operation` 的 payload 语义（增量还是绝对值），
  把结论写进 `design.md`。
- [x] 5.2 Red：播放头位于 200 ms 时在采样文档上拖动对象，断言新关键帧的值等于最终**绝对**位置，
  且 0 ms 关键帧与基础文档静态值都不变。
- [x] 5.3 Green：在 dispatch 链路上实现命令 → `animation.keyframe.set` 的改写层，
  覆盖 Transform、LayoutItem 几何与 Appearance。
- [x] 5.4 Red/Green：自动记录关闭时修改照常写基础文档。

## 6. preview 播放

- [x] 6.1 Red：无动画时不显示播放控件、关闭对话框停止播放的测试。
- [x] 6.2 Green：在 `preview-dialog` 增加播放控件与 rAF 循环，卸载时释放。

## 7. 验证

- [x] 7.1 各包 `test` / `typecheck` / `build`。
- [x] 7.2 仓库根 `bun run lint && bun run typecheck && bun run test && bun run build`。
  typecheck 与 build 全绿；lint 剩 1 条本变更之前就存在的 `react-hooks/refs`
  （compose-editor.tsx `componentContextMenuItems`），test 剩 2 个既有的只读页面 JSON
  标签失败（page-workspace.test.tsx），均与本变更无关。
- [x] 7.3 `bun run test:e2e`：新增"动画模式 / 打点、拖播放头、画布采样与撤销"用例并通过。
  该用例抓出并修复了两个真实缺陷：动画模式激活监听挂在内层 core Dockview 而底部工具组
  属于外层（标签点击永远不触发）；时间线空态→首条轨道切换后测量 ResizeObserver 未重挂
  （标尺宽度停在 0）。既有 9 个 e2e 失败源自 add-workspace-edge-rails 重构与物料清单
  漂移（基础组件 3→4）未同步 e2e，属于该变更的欠账，不在本变更范围内。
- [x] 7.4 `openspec validate add-animation-mode-binding --strict`。
- [x] 7.5 `openspec archive update-animation-panel-foundation --skip-specs --yes`。
