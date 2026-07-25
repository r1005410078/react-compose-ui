# @compose-ui/stage

DOM Scene Layer 与屏幕坐标 SVG Overlay 组合的无限编辑 Stage。

- DOM Viewport 管理无限世界坐标、平移、缩放和 CSS 网格。
- DOM Scene 渲染多个根级 Frame、Group 与 registry React 组件。
- SVG Overlay 渲染 marquee、选区、八向缩放/旋转手柄、6 屏幕像素吸附线。
- Pointer 手势仅维护 rAF 预览，pointerup 派发一个 `node.transform.set` 事务；取消会恢复。
- `ComponentPalette` 与 `Stage` 通过实例级 `StageDragController` 共享 Pointer/键盘拖入会话。
- `StageFramePreset` 让 Palette 在 definitions 之前显示并创建根级 Frame。
- Frame、Group 与 Component 使用 core `resolveNodeStyle`；inset 边框不改变文档几何。

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
    selectedIds={selectedIds}
    onSelectedIdsChange={setSelectedIds}
    activeFrameId={activeFrameId}
    onActiveFrameIdChange={setActiveFrameId}
    dragController={dragController}
  />
</>
```

Stage 还导出纯几何换算与 `createGroupCommand`、`createUngroupCommand`、
`createReparentCommand`、`createDuplicateCommand`。文档和命令协议不暴露 DOM/SVG 细节；
首版没有 Canvas 2D 后端切换。
