## 上下文

React Compose UI 需要承载文本、ECharts、宿主业务组件和 Valibot 属性 Inspector。纯 Canvas 2D
无法自然承载任意 React 子树，纯 SVG 则会迫使复杂 HTML 组件依赖 `foreignObject`。因此 Stage
是编辑器产品概念，不等同于 HTML `<canvas>`；首版采用 DOM 内容层与 SVG 编辑覆盖层。

本变更依赖 `add-command-transaction-runtime` 的 `ComposeDocument`、内置命令和事务运行时，不得
在 Stage 内另建文档状态或撤销系统。

## 目标/非目标

- 目标：提供可独立嵌入、受控、无限视口的 React Stage。
- 目标：让宿主 React 组件、场景树、属性 Inspector 和 Preview 共享同一文档与注册表。
- 目标：让一次 Pointer/键盘编辑只产生一次原子事务。
- 目标：用 Frame 明确预览输出边界，同时允许工作区包含多个 Frame。
- 非目标：纯 Canvas/SVG 渲染后端切换、响应式断点、协作编辑、发布、服务端持久化和图片导出。

## 决策

### 组件注册边界

- `@compose-ui/component-registry` 依赖 core，并把 React 作为 peer dependency；不得依赖 editor、
  stage、preview 或 property-panel。
- `ComponentDefinition` 包含 type、label、可选 icon、默认尺寸、JSON props factory、renderer
  和可选 Inspector renderer。Inspector 回调接收节点与 dispatch，可由宿主返回 PropertyPanel。
- registry 是实例级只读对象，拒绝空 type、重复 type、非法尺寸或非 JSON 默认 props。
- 文档可保留未知 componentType；Stage/Preview 显示错误占位并继续允许安全的编辑或删除。

### Stage 分层

- Stage 根节点是有确定尺寸的 DOM viewport。Viewport state 为 `{ x, y, zoom }`，x/y 使用屏幕
  CSS 像素，zoom 默认限制在 0.1～8。
- DOM Scene Layer 使用一个 viewport CSS transform 映射世界坐标，并以嵌套绝对定位 DOM
  渲染 Frame、Group 与 Component。组件内部可以使用 Canvas、SVG、视频或普通 HTML。
- SVG Overlay 覆盖可视 viewport，使用屏幕坐标渲染 marquee、selection bounds、八向 resize
  handles、rotation handle、snap guides 和 drop indicator，使控制点大小不随 zoom 改变。
- 网格使用随 viewport 平移缩放的 CSS background。首版不暴露 renderer backend 选择，也不把
  DOM/SVG 节点写入文档协议。

### 坐标和 Frame

- Frame 是 root 节点，rotation 固定为零；工作区可以包含多个可移动、可缩放 Frame。
- Group/Component transform 相对直接父节点。世界几何通过二维仿射矩阵组合得到。
- reparent 与 group/ungroup 必须把世界几何分解回新父节点局部 transform。因为父节点不保存
  持久 scale/skew，Group resize 会在一个 batch 中比例更新后代局部位置/尺寸。
- Preview 以指定 Frame 左上角为原点并裁剪到 Frame width/height。

### Pointer 状态机

- 原生 Pointer Events 驱动 `idle | panning | marquee | moving | resizing | rotating |
  palette-drag` 状态。Stage 在手势开始时捕获 pointer 并保存文档基线。
- pointermove 只通过 `requestAnimationFrame` 更新受影响 DOM/SVG 的瞬时预览；不 dispatch、
  不写 History、不写 Operation Log。
- pointerup 根据基线与最终几何派发一个内置命令或 batch。Escape、pointercancel、lost capture
  恢复基线且不派发文档命令。
- select 工具支持点击、Shift 切换选择和空白区 marquee；pan 工具、按住 Space 或中键只修改
  viewport。Cmd/Ctrl+wheel 以游标为锚缩放，普通 wheel 平移。
- Shift 在 resize 时保持宽高比、在 rotation 时量化到 15°；Alt 从中心 resize；Cmd/Ctrl 在
  变换期间临时关闭吸附。

### 多选、吸附和键盘

- selection、activeFrameId、viewport、tool 和临时 guides 是受控会话状态，不属于文档。
- 多选 move/resize/rotate 使用共同世界包围框，将结果转换回各自父节点。Group 仅允许同一直接
  父节点下的未锁定非 Frame 节点；跨父节点选择可以移动，但不能 group。
- snap 候选来自当前 Frame 边缘/中心与可见、未选中兄弟节点边缘/中心；阈值为 6 屏幕像素，
  再按 zoom 转换到世界距离。
- Delete/Backspace 删除，方向键移动 1 世界单位，Shift+方向键移动 10，Cmd/Ctrl+D 复制，
  Cmd/Ctrl+G group，Cmd/Ctrl+Shift+G ungroup；键盘重复 nudge 使用 mergeKey 合并。
- locked 节点可以被场景树选中但不能直接变换或删除；hidden 节点不在 Stage 中渲染或参与吸附。

### Palette 拖入

- `ComponentPalette` 与 `Stage` 通过实例级 `StageDragController` 共享 palette-drag 会话，不使用
  HTML Drag and Drop 或模块级全局状态。
- pointerdown 后显示拖拽预览；进入 Stage 时转换 clientPoint 到世界坐标并计算目标 Frame。
- pointerup 位于有效 Frame 时由 definition factory 创建 JSON props，派发一次 component.create
  并选择新节点；Frame 外 drop 发布 rejected 调试事件但不修改文档。

### Editor controller

- `useComposeEditorController` 组合外部 TransactionRuntime 与 ComponentRegistry，并管理选择、
  展开、activeFrame、viewport、tool 和 StageDragController。
- controller 派生 SceneTreeProps、StageProps、HistoryNavigationController、Inspector 内容和
  CommandPanel controller，不复制正式文档。
- editor 不依赖 operation-log。controller 接受单一 transaction observer；示例在 observer 中
  映射 committed/undo/redo 到现有 `record`，异步失败不影响 runtime。
- 有 controller 且宿主未覆盖时，左侧增加 Component Library 标签、中央渲染默认 Stage、右侧
  使用 definition Inspector、底部使用 CommandPanel。没有 controller 时保留现有插槽行为。

### 兼容与 Preview

- `stageToolbar` 是新的首选插槽；`canvasToolbar` 继续工作并通过 TSDoc 标记废弃。两者同时提供时
  stageToolbar 优先。
- 显式 `children` 始终覆盖默认 Stage；旧宿主不传 controller 时 UI 与快捷键行为保持兼容。
- Preview 依赖 core 与 component-registry，不依赖 editor/stage。它复用 renderer，但自行构建
  无编辑 Overlay 的 DOM Frame 树。
- `ComposePreview` 在完整提供 document/registry/frameId 时渲染文档；三者均未提供时保留 legacy
  children；只提供部分文档参数时显示可访问配置错误。

## 风险/权衡

- DOM 节点很多时布局成本上升 → 首版以大屏业务组件为目标，手势用 rAF 合并；建立基准后再决定
  是否虚拟化或增加专用渲染后端。
- 嵌套旋转下坐标容易漂移 → 所有世界/局部转换集中在纯矩阵模块并用往返误差测试覆盖。
- SVG Overlay 与 DOM Scene 可能错位 → 两层共享同一 viewport 快照，Overlay 统一使用
  world-to-screen 结果，不复制 CSS transform 规则。
- 外部 renderer 可能抛异常 → 每个 Component 使用错误边界隔离，未知/失败 renderer 使用稳定占位。
- 跨 Dockview Pointer 拖入容易丢事件 → StageDragController 在 window 级监听会话事件，结束时
  必须释放监听与 pointer 状态。

## 迁移计划

1. 新增 registry 与 Stage 独立包，并以 fixture runtime 完成组件测试。
2. 新增 editor controller 和 Component Library 标签，保留无 controller 的原行为。
3. 把示例 Text、Rectangle、ECharts 注册为 definitions，移除手写 Canvas 渲染分支。
4. 扩展 Preview 并完成指定 Frame 的编辑到预览纵向流程。
5. 更新 README、project 当前完成度和发布配置。

没有持久化迁移。旧 `children` 与 `canvasToolbar` 调用保持可用。

## 待解决问题

无。性能优化必须以本变更建立的确定性大文档基准为依据，不能在首版提前引入 Canvas 后端。
