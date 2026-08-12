# 设计：Godot 风格 Stage 工具与绘制工作流

## 上下文

现有 `ComposeStageTool` 与 `StageInteractionContext.tool` 只支持 `select | pan`。选择 Overlay 同时显示
当前 GeometryConstraints 所允许的 resize handles 与旋转 handle；默认 editor toolbar 又把容器创建、适配、
两类吸附、画布设置和缩放混在同一条带上。Palette 的 Entity Preset 拖入已遵循“stage-engine 只解析几何，
Stage React adapter 使用 Registry 创建 seed”的边界，这可作为拖拽绘制的实现模式。

## 目标与非目标

- 目标：工具栏能清楚表达当前工具，鼠标光标、canvas overlay 与实际操作一致。
- 目标：选择工具保持原有纯箭头图标；四角缩放只出现在选中对象，X/Y gizmo 只在精确移动工具激活时出现。
- 目标：所有绘制从 registry Preset 创建合法 v6 Entity，并保留吸附、取消、一次提交与 History 语义。
- 目标：缩放/居中控件随 viewport 更新但不重渲无关工作区面板。
- 非目标：改写 v6 Document、History 协议、Layout Engine 或已有 Renderer 的持久化字段。
- 非目标：实现钢笔、自由路径、布尔形状、文本排版编辑或任意 SVG 路径编辑。

## 决策

### 1. 统一工具模型与专属 canvas feedback

在 `@compose-ui/stage-engine` 定义无 React 的 `StageInteractionTool`，由 `@compose-ui/stage` 的
`ComposeStageTool` 复用，避免两个包维护不同 union：

```text
select | move | scale | rotate | pan
draw-container | draw-rectangle | draw-line | draw-arrow | draw-circle | draw-text
```

- **选择/变换 (`select`)**：点击、Shift 多选、框选、拖动移动；显示四个角上的 8px square handles。
  选择框四边保留透明命中带，hover 使用 `ns-resize` / `ew-resize`，但不画中点 handle；角落使用对角 resize
  cursor。rotation handle 在本模式不显示。
- **精确移动 (`move`)**：选中对象左上出现红 X（向右）与绿 Y（向下）轴。拖 X/Y 只更新一个轴；拖选框本体
  保留自由移动。未选中对象时不显示 gizmo，也不创建绘制实体。
- **缩放 (`scale`)**：使用清晰的“由小方块向外扩展”的 icon；只开放 resize 命中，不允许本体拖动移动。
- **旋转 (`rotate`)**：只显示并启用 rotation handle；保留所有既有约束、preview/cancel/单事务语义。
- **移动画布 (`pan`)**：复用现有 pan 和 Space/中键临时 pan。

工具切换、overlay、cursor 和命令可用性均以这一枚受控 tool 为事实来源。Flow 转 Absolute、Fill 转 Fixed、
锁定/不可见、GeometryConstraints 与 Cmd/Ctrl 临时关闭吸附继续沿用现有 engine 规则。

### 2. 绘制状态机仍保持 headless

Stage engine 新增 draw preview/commit descriptor，但不读取 Registry、Renderer props、React 或 DOM：pointer down
记录 world 起点，move 发布暂态 geometry，pointer up 产生单一 `drawing.commit` effect；Escape、cancel、blur 或
无有效几何都只清理 preview。`ComposeStage` 收到 effect 后把 tool 映射到 preset ID，使用 Registry 创建 seed，
按拖拽世界 bounds 覆盖 LayoutItem，并在容器命中时使用合法 parent 创建命令。拖拽过程不 dispatch。

`draw-text` 的零距离 click 以 Text preset 默认尺寸插入；拖拽则使用拖拽宽高创建 text box。其余图形均需要
最小 1×1 world size。绘制工具在成功后保持激活，以便连续创建；`V` 或 Escape 返回选择工具。

### 3. 基础形状 material

Rectangle、Container、Text 使用既有 Preset。新增 `shape` Renderer 和 `line`、`arrow`、`circle` Preset：

- Line/Arrow 使用结构化 Renderer props 表达种类、起终点方向、stroke 和 marker；负向拖拽不依赖负尺寸，
  而是规范化 world bounds 后记录 local direction。
- Circle 使用同一 Renderer 的 ellipse kind，按拖拽 bounds 渲染；Shift 在首版不强制正圆，尺寸约束仍由
  GeometryConstraints 控制。
- 这些 Renderer 继续只依赖 `core`、`components`、`property-panel`、`ui-context` 等既有 materials 边界，
  不引用 Stage 或 editor。

### 4. 默认工具栏、网格与快捷键

默认 toolbar 使用单行原生 `button`，无 Card/胶囊容器，分隔线只分隔工具类别。布局顺序是：

```text
选择 | 精确移动 | 缩放 | 旋转 | 平移 | 吸附 | 网格 + 大小菜单 | 分隔线 |
容器 | 形状 + 菜单 | 文字
```

形状 trigger 使用 menu-button：主按钮重选最近一个形状工具，chevron 打开 Rectangle、Line、Arrow、Circle；菜单
中的可见快捷键是对应 action 的当前偏好值。网格主按钮仅切换**会话级**网格可见性，不修改文档；其相邻菜单以
4、8、16、32 等方格预设原子更新持久化 `canvas.grid.stepX/stepY`，并提供“更多画布设置”进入已有设置弹层。
吸附主按钮作为总开关，原子保存/恢复 grid、node、guide 三种现有吸附意图；高级细项仍在“更多画布设置”。

顶栏不再保留 zoom、fit 或 canvas settings 单独图标。视口控件被包在 editor 内部 Stage 组合中，但视觉上为无
Card 的行内图标：中心视图、缩小、百分比、放大。它避开 ruler/scrollbar，覆盖层本身 `pointer-events: none`，
只有各 button 可点击。

### 5. 快捷键冲突处理

初步快捷键为 `V` select、`M` move、`S` scale、`H` pan、`C` container、`L` line、`Shift+L` arrow、`O`
circle、`T` text。`R` 同时被用户指定给 Rectangle，又可能用作 Rotate，不能在同一 Stage shortcut scope 下共存。
**建议默认保留 `R` 给 Rectangle，将 Rotate 设为 `Shift+R`**；工具栏和偏好设置都以最终 action map 显示，
且设置 UI 继续拒绝同 scope 冲突。该一个快捷键裁决需在实施前由用户确认。

## 风险与权衡

- 这不是纯 toolbar 改样式：扩大公开 tool union 会让穷尽 switch 的宿主需要覆盖新成员；通过保留既有
  `select`、`pan` 值和 TSDoc migration note 降低升级风险。
- 线、箭头与圆若借用任意 SVG 资源会失去 Inspector、序列化和反向拖拽语义；新增结构化 Shape material 虽然
  工作量更大，但边界与 v6 保持一致。
- 总吸附开关需要记住三个子开关的用户意图；controller 使用会话 ref 保存上次非全关组合，关闭时原子写全关，
  重开时还原该组合，避免强制某个单项为 true。
- 当前视觉稿只展示移动工具状态；实现和视觉黄金必须分别覆盖选择、移动、缩放、旋转、绘制和菜单状态。

## 待确认项

- 是否接受 `R` 为 Rectangle、`Shift+R` 为 Rotate 的默认绑定？
