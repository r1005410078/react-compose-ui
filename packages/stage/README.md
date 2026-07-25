# @compose-ui/stage

DOM Scene Layer 与屏幕坐标 SVG/DOM Overlay 组合的无限编辑 Stage。

- 固定 24px 顶部/左侧标尺与 10px 右侧/底部可访问滚动条不参与世界缩放。
- 自适应细网格和主网格从 `document.canvas` 读取 X/Y step、offset 与主线间隔；视觉抽稀不改变
  实际吸附刻度。
- 红色 X 轴、绿色 Y 轴标记世界 `(0,0)`；标尺随 viewport 显示正负坐标和实时选择 AABB 尺寸。
- DOM Scene 渲染多个根级 Frame、Group 与 registry React 组件；SVG Overlay 渲染 marquee、
  八向缩放/旋转手柄、全局辅助线与 6 屏幕像素智能吸附线。
- move 与八向 resize 按“辅助线/节点智能吸附优先，网格回退”工作；Cmd/Ctrl 可临时关闭全部
  吸附。
- 可从顶部或左侧标尺拖出辅助线，从交叉角一次创建双轴辅助线；拖回对应标尺删除。
- Pointer 手势仅维护 rAF 预览，pointerup 最多派发一个 `node.transform.set`、canvas 命令或
  原子 batch；取消会恢复。
- 滚动范围包含可见节点、世界原点和当前视口，在 Stage 会话内单调扩展；滚动只更新受控
  viewport，不进入文档历史。
- `ComponentPalette` 与 `Stage` 通过实例级 `StageDragController` 共享 Pointer/键盘拖入会话。
- `StageFramePreset` 让 Palette 在 definitions 之前显示并创建根级 Frame。
- Frame、Group 与 Component 使用 core `resolveNodeStyle`；inset 边框不改变文档几何。
- 默认从 `@compose-ui/ui-context` 读取主题与语言；`locale="zh-CN|en-US"` 作为显式兼容覆盖，
  优先于 Context。内建标尺、滚动条与覆盖层 ARIA 会翻译，registry label 与 renderer 内容
  保持宿主原文。
- `shortcuts` 可覆盖临时平移、V/H 工具、F/Shift+F 适配、缩放、吸附、复制、分组和删除；
  动作空数组表示禁用。输入控件、contenteditable 和 IME composing 不触发 Stage 导航键。

```tsx
import {
  ComponentPalette,
  Stage,
  createStageDragController,
} from '@compose-ui/stage'
import '@compose-ui/stage/styles.css'

const dragController = createStageDragController()

<>
  <ComponentPalette
    registry={registry}
    framePresets={framePresets}
    dragController={dragController}
  />
  <Stage
    document={runtime.document}
    registry={registry}
    dispatch={runtime.dispatch}
    viewport={viewport}
    onViewportChange={setViewport}
    tool="select"
    onToolChange={setTool}
    locale="zh-CN"
    shortcuts={{
      'stage.temporaryPan': [{ code: 'Space' }],
    }}
    selectedIds={selectedIds}
    onSelectedIdsChange={setSelectedIds}
    activeFrameId={activeFrameId}
    onActiveFrameIdChange={setActiveFrameId}
    onSurfaceSizeChange={setSurfaceSize}
    dragController={dragController}
  />
</>
```

`onSurfaceSizeChange` 是可选回调，返回扣除标尺和滚动条后的真实 surface 尺寸，适合宿主实现
fit Frame/selection。Stage 还导出标尺、网格吸附、滚动范围等纯几何换算，以及
`createGroupCommand`、`createUngroupCommand`、`createReparentCommand`、
`createDuplicateCommand`。文档和命令协议不暴露 DOM/SVG 细节；当前没有 Canvas 2D 后端切换。
