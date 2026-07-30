## 1. node 基础 editor 与拖入赋值

- [ ] 1.1 `property-panel/editor-ports.ts`：`ComposePropertyPanelNodeCandidate`、
  `ComposePropertyPanelNodeEditorPort`、`PropertyPanelEditorPorts.node`、
  `useComposePropertyPanelNodeEditorPort`，并从功能目录与包公共入口两级导出
- [ ] 1.2 `compose-property-panel.tsx`：`PropertyPanelChangeReason` 增 `'drop'`、
  `ComposePropertyPanelProps.nodeEditor`、ports memo 增 `node`
- [ ] 1.3 `semantic-editors/base-editors.tsx`：`PROPERTY_PANEL_BASE_EDITOR_IDS` 追加 `'node'`，
  实现 `NodeEditor`（combobox trigger + 可筛选 listbox + 清空 + drop target），
  经 `withSingleValueBinding('node', NodeEditor)` 注册进 `PROPERTY_PANEL_BASE_RENDERERS`
- [ ] 1.4 `property-panel/styles.css`：`.property-panel__semantic--node` 与 `data-drop-active` 样式
- [ ] 1.5 `semantic-editors.test.tsx`：id 列表含 `node`、候选选择、清空、未知值占位、
  只读与绑定下不提交
- [ ] 1.6 `compose-property-panel.test.tsx`：类型交集命中才接受拖拽、无关拖拽不阻止默认行为、
  载荷不可解析时不提交、以 `'drop'` 为原因提交、未注入端口时的无候选状态
- [ ] 1.7 a11y 测试：trigger 的 combobox role 与可读名、listbox 键盘导航、`Escape` 关闭并恢复焦点、
  trigger 上 `Delete`/`Backspace` 清空
- [ ] 1.8 `asset-browser`：`COMPOSE_ASSET_REFERENCE_DRAG_MEDIA_TYPE`、
  `parseComposeAssetReferenceDragData`、`startNativeDrag` 始终写入引用载荷、
  `canDragEntryToCanvas` prop 与 `canvasItemFor` 接线（含 TSDoc）
- [ ] 1.9 `asset-browser` 测试：两个 MIME 同时写入且引用载荷在条目不可移动时仍写入、
  判定回调放宽白名单、未被接受的文件仍被排除
- [ ] 1.10 `packages/materials/src/material-inspector-kit/node.ts`：`composeNodePropertySchema()`
  + 测试（空值与完整引用通过、字段缺失或类型错误不通过）
- [ ] 1.11 `component-registry/src/registry/types.ts` 与 `compose-registry-renderers.tsx`：
  `pageNodePort` 声明与透传 + 测试（端口到达 Inspector、引用稳定、缺省时正常渲染）
- [ ] 1.12 `packages/editor/src/pages/use-node-editor-port.ts`：候选映射、`parseDrop`
  （引用载荷优先、id 载荷经页面目录回退）、`resolveLabel` 占位文案；经
  `entity-inspector.tsx` 与 `editor-controller/controller.tsx` 投递
- [ ] 1.13 `editor` 向 asset-browser 传 `canDragEntryToCanvas`（页面文件）
- [ ] 1.14 `bun run lint && bun run typecheck && bun run test && bun run build`

## 2. page-slot 与嵌套实时渲染

- [ ] 2.1 **红灯先行**：先写「编辑态嵌套内容不抢命中测试」的测试与
  「框选/吸附候选/场景树投影不把嵌套实体算进去」的断言，确认失败后再实现
- [ ] 2.2 `packages/pages/src/page-document-loader.ts` + 测试：`createComposePageDocumentLoader`
  （按引用加载、命中 Store 缓存、变更通知、取消订阅）
- [ ] 2.3 `component-registry`：`pageDocumentPort` 声明与透传 + 测试
- [ ] 2.4 `packages/materials/src/page-slot/nest-context.tsx`：祖先页面链与深度 Context
- [ ] 2.5 `packages/materials/src/page-slot/renderer.tsx` + `styles.css`：加载状态机
  （loading 带忙碌语义 / error 带警示语义与重试 / empty / loaded）、`AbortController`、
  `loader.subscribe` 去抖重载、迟到结果丢弃、递归渲染、编辑态 `pointer-events: none`
- [ ] 2.6 `packages/materials/src/page-slot/definition.tsx` + `preset.ts`：`page` 属性、Inspector、
  `assetDrop`（`accepts` 判页面、`createSeed` 取被引用页面输出尺寸，读不到时用默认尺寸）
- [ ] 2.7 `packages/stage/src/types.ts` 与 stage surface：`pageLoader` 注入
- [ ] 2.8 `packages/preview/src/compose-preview/compose-preview.tsx`：`pageLoader` 注入
- [ ] 2.9 `editor`：由页面 Store 派生默认 loader 传给 Stage
- [ ] 2.10 测试：loading→loaded、失败重试、空页面、自环警示、深度超限警示（深度边界 7/8/9）、
  卸载后无状态更新、拖页面入画布创建实体、非页面文件被拒绝
- [ ] 2.11 Playwright：拖页面进 `node` 字段 → 画布与预览均渲染嵌套内容；页面引用自身 →
  警示而非卡死；拖页面到画布空白处生成 Page Slot 实体

## 3. 收口

- [ ] 3.1 文档同步：`packages/property-panel/README.md` 的稳定 editor ID 列表追加 `node`
- [ ] 3.2 `.changeset/` 变更集
- [ ] 3.3 全量验证：`bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`、
  `bun run test:e2e`
