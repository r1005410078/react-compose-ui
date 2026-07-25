## 上下文

Stage 已使用受控 `{x, y, zoom}` viewport、DOM Scene 与屏幕坐标 SVG Overlay。选择、工具和
viewport 是会话状态；正式编辑都通过 core TransactionRuntime。新能力必须保持该边界，同时让
网格配置和辅助线跟随页面文档保存。

## 目标/非目标

- 目标：提供 Godot 风格的坐标标尺、世界原点轴、实际网格吸附和双向滚动导航。
- 目标：让网格设置与全局辅助线可序列化、可撤销、可审计。
- 目标：让 move、resize、guide drag 共享确定性的吸附规则。
- 非目标：持久化 viewport、选择或滚动范围；引入 Canvas 2D 场景后端；兼容 v1 文档。

## 决策

### ComposeDocument v2

- `schemaVersion` 固定为 2，`canvas` 为必填字段，包含 grid、smartSnap 与 guides。
- 默认 stepX/stepY 为 8，offset 为 0，primaryLineEvery 为 8，三类吸附默认开启。
- guide 使用稳定 ID、`x|y` 轴和有限世界 position；同一文档中 ID 必须唯一。
- core 提供 `createDefaultCanvasSettings` 生成独立默认 JSON，并严格拒绝缺失或非法字段。
- `canvas.configure` 原子替换 grid/smartSnap；guide create/move/delete 产生精确 inverse。

### Stage 层次与坐标

- Stage 外壳使用 24px 顶部/左侧 ruler、中央 surface、10px 右侧/底部 scrollbar。
- Scene、grid、origin、guides 和 editing overlay 都只使用 surface 坐标；ruler/scrollbar 保持
  屏幕像素尺寸，不进入 world transform。
- grid 视觉可按 zoom 跳过过密线，但 snap 始终使用文档原始 step。
- 红色 X 轴与绿色 Y 轴穿过世界 `(0,0)`；选择标记使用实时世界轴对齐包围框。

### 吸附

- 节点/Frame/辅助线候选只在 6 屏幕像素内参与；每轴取最小修正，距离相同时辅助线优先。
- 智能候选存在时优先于网格；否则 move 的包围框左上角或 resize 的活动边量化到 grid。
- Cmd/Ctrl 临时关闭全部吸附；guide drag 在 grid 开启时量化，使用同一临时关闭规则。
- pointermove 只更新 rAF 预览；pointerup 最多提交一个 transform 或 canvas 命令。

### 无限滚动条

- 虚拟范围取可见节点 bounds、世界原点与当前可视 world rect 的并集，并在每边增加至少一个
  viewport span。
- 范围在 Stage 挂载会话内只扩不缩，避免内容变化导致 thumb 跳动；拖到边缘时再扩一屏。
- scrollbar 只修改受控 viewport，不写 ComposeDocument 或 History；支持 Pointer、轨道翻页和
  Arrow/Page/Home/End 键盘导航。

### Editor 与 Preview

- toolbar 快捷按钮立即派发 `canvas.configure`；设置弹层使用本地 draft，Apply 一次提交，
  Cancel 不修改文档。
- Stage 用 ResizeObserver 上报真实 surface size；fit Frame/selection 不再使用 900×600 常量。
- Preview 接受 v2 文档并完全忽略 canvas 编辑元数据。

## 风险/权衡

- v2 无迁移会直接拒绝旧 JSON → 本变更按已确认决策一次升级全部仓库 fixture 和文档。
- ruler/grid DOM 数量可能随 zoom 增大 → 纯函数自适应抽稀并限制可视 tick 数量。
- 自定义 scrollbar 比原生 overflow 复杂 → 以纯 range/thumb 几何和 ARIA 组件测试覆盖。
- Stage 组件继续膨胀 → 将 ruler、grid、scroll range 和 snap 计算拆到独立纯模块。

## 迁移计划

1. 先升级 core 类型、校验、命令与全部 fixture 到 v2。
2. 在保持旧 Stage 交互测试可运行的前提下替换 surface 坐标和 grid/snap 逻辑。
3. 增加 ruler、guide、scrollbar 与 editor toolbar，再更新示例和视觉黄金文件。
