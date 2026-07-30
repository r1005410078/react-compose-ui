## 1. node 基础 editor 与拖入赋值

- [x] 1.1 `property-panel/editor-ports.ts`：`ComposePropertyPanelNodeCandidate`、
  `ComposePropertyPanelNodeEditorPort`、`PropertyPanelEditorPorts.node`、
  `useComposePropertyPanelNodeEditorPort`，并从功能目录与包公共入口两级导出
- [x] 1.2 `compose-property-panel.tsx`：`PropertyPanelChangeReason` 增 `'drop'`、
  `ComposePropertyPanelProps.nodeEditor`、ports memo 增 `node`
- [x] 1.3 `semantic-editors/base-editors.tsx`：`PROPERTY_PANEL_BASE_EDITOR_IDS` 追加 `'node'`，
  实现 `NodeEditor`（combobox trigger + 可筛选 listbox + 清空 + drop target），
  经 `withSingleValueBinding('node', NodeEditor)` 注册进 `PROPERTY_PANEL_BASE_RENDERERS`
- [x] 1.4 `property-panel/styles.css`：`.property-panel__semantic--node` 与 `data-drop-active` 样式
- [x] 1.5 `semantic-editors.test.tsx`：id 列表含 `node`、候选选择、清空、未知值占位、
  只读与绑定下不提交
- [x] 1.6 `compose-property-panel.test.tsx`：类型交集命中才接受拖拽、无关拖拽不阻止默认行为、
  载荷不可解析时不提交、以 `'drop'` 为原因提交、未注入端口时的无候选状态
- [x] 1.7 a11y 测试：trigger 的 combobox role 与可读名、listbox 键盘导航、`Escape` 关闭并恢复焦点、
  trigger 上 `Delete`/`Backspace` 清空
- [x] 1.8 `asset-browser`：`COMPOSE_ASSET_REFERENCE_DRAG_MEDIA_TYPE`、
  `parseComposeAssetReferenceDragData`、`startNativeDrag` 始终写入引用载荷、
  `canDragEntryToCanvas` prop 与 `canvasItemFor` 接线（含 TSDoc）
- [x] 1.9 `asset-browser` 测试：两个 MIME 同时写入且引用载荷在条目不可移动时仍写入、
  判定回调放宽白名单、未被接受的文件仍被排除
- [x] 1.10 `packages/materials/src/material-inspector-kit/node.ts`：`composeNodePropertySchema()`
  + 测试（空值与完整引用通过、字段缺失或类型错误不通过）
- [x] 1.11 `component-registry`：`ComposeNodeEditPort` 声明与透传（命名为 `nodeEditPort`，
  与既有 `paintEditPort` 一致）
- [x] 1.12 `packages/editor/src/pages/use-node-editor-port.ts`：候选映射、`parseDrop`
  （引用载荷优先、id 载荷经页面目录回退）、`resolveLabel` 占位文案；经
  `entity-inspector.tsx` 与 `editor-controller/controller.tsx` 投递
- [x] 1.13 `editor` 向 asset-browser 传 `canDragEntryToCanvas`（页面文件）
- [x] 1.14 `bun run lint && bun run typecheck && bun run test && bun run build`

## 2. page-slot 与嵌套实时渲染

- [x] 2.1 **红灯先行**：先写「编辑态嵌套内容不抢命中测试」的测试，确认失败后再实现。
  「不把嵌套实体算进场景索引」的断言放在 `stage-engine`（materials 不得依赖它），
  且该性质是 by construction 成立的，断言用于防回归 —— 见 design.md 风险段订正
- [x] 2.2 `packages/pages/src/page-document-loader.ts` + 测试：`createComposePageDocumentLoader`
  （按引用加载、命中 Store 缓存、变更通知、取消订阅）
- [x] 2.3 `component-registry`：`ComposeRendererProps` 增 `pageDocumentPort` 与 `registry`
  （后者供需要递归渲染其他 Entity 的 Renderer 使用）
- [x] 2.4 `packages/materials/src/page-slot/nest-context.tsx`：祖先页面链与深度 Context
- [x] 2.5 `packages/materials/src/page-slot/renderer.tsx` + `styles.css`：加载状态机
  （loading 带忙碌语义 / error 带警示语义与重试 / empty / loaded）、`AbortController`、
  `loader.subscribe` 去抖重载、迟到结果丢弃、递归渲染、编辑态 `pointer-events: none`
- [x] 2.6 `packages/materials/src/page-slot/definition.tsx` + `preset.ts`：`page` 属性、Inspector、
  `assetDrop`（`accepts` 判页面、`createSeed` 取被引用页面输出尺寸，读不到时用默认尺寸）
- [x] 2.7 `packages/stage/src/types.ts` 与 stage surface：`pageLoader` 注入
- [x] 2.8 `packages/preview/src/compose-preview/compose-preview.tsx`：`pageLoader` 注入
- [x] 2.9 `editor`：由页面 Store 派生默认 loader 传给 Stage
- [x] 2.10 测试：loading→loaded、失败重试、空页面、自环警示、深度超限警示、未设置引用占位、
  编辑态不抢命中测试、`assetDrop` 的接受判定与 createSeed（含页面不可解析时回退默认尺寸）
- [x] 2.11 Playwright：选中页面后画布与预览均渲染嵌套内容。
  —— 自环警示与「拖页面到画布空白处生成实体」由单元测试覆盖，未做 e2e：前者在真实画布上
  构造自引用需要额外步骤，后者的 Stage 外部拖入在 Playwright 中不稳定

## 3. 收口

- [x] 3.1 文档同步：`packages/property-panel/README.md` 的稳定 editor ID 列表追加 `node`
- [x] 3.2 `.changeset/` 变更集
- [x] 3.3 全量验证：`bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`、
  `bun run test:e2e`
  —— e2e 19 passed / 2 failed；这 2 项已用基线提交 9335323 的源码复现同样失败，与本变更无关
