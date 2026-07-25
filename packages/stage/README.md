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
- Pointer/键盘事件由 Stage 归一化后发送到 `@compose-ui/stage-engine`；引擎手势仅维护
  preview snapshot，pointerup 最多返回一个 `node.transform.set`、canvas 命令或原子 batch。
- 滚动范围包含可见节点、世界原点和当前视口，在 Stage 会话内单调扩展；滚动只更新受控
  viewport，不进入文档历史。
- `ComponentPalette` 与 `Stage` 通过实例级 `StageInteractionController` 共享内部手势和
  Pointer/键盘外部拖入会话。
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
} from '@compose-ui/stage'
import { createStageInteractionController } from '@compose-ui/stage-engine'
import '@compose-ui/stage/styles.css'

const interactionController = createStageInteractionController()

<>
  <ComponentPalette
    registry={registry}
    framePresets={framePresets}
    interactionController={interactionController}
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
    interactionController={interactionController}
    framePresets={framePresets}
  />
</>
```

`onSurfaceSizeChange` 是可选回调，返回扣除标尺和滚动条后的真实 surface 尺寸，适合宿主实现
fit Frame/selection。标尺、网格吸附、滚动范围、矩阵与坐标函数、SceneIndex、controller，
以及 `createGroupCommand`、`createUngroupCommand`、`createReparentCommand`、
`createDuplicateCommand` 只从 `@compose-ui/stage-engine` 导出；Stage 不提供旧路径或兼容
facade。一个 controller 同时只能连接一个 Stage surface，多个编辑器实例应各自创建 controller。

省略 `Stage.interactionController` 时，Stage 会创建并销毁私有 controller；由于 Palette 必须
与目标 Stage 共享外部拖入会话，`ComponentPalette.interactionController` 是必填属性。Editor
组合场景下建议使用 `useComposeEditorController`，它会负责 controller 的单实例所有权与释放。
