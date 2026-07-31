# @compose-ui/stage

DOM Scene Layer 与屏幕坐标 Overlay 组合的无限编辑 Stage。

Stage 消费 `ComposeDocument v6`、正式 `ComposeLayoutSnapshot` 与 `ComposeEntityRegistry`。Scene 渲染查询拥有 `LayoutItem + Transform`
且包含 `Renderer` 或 `Hierarchy` 的 Entity；同一 Entity 可以先渲染 Renderer 内容，再渲染
Hierarchy 子项。`Appearance`、`Clip`、`Visibility` 与 `Lock` 分别由对应查询处理。

```tsx
import { ComposeComponentPalette, ComposeStage } from '@compose-ui/stage'
import { createStageInteractionController } from '@compose-ui/stage-engine'
import '@compose-ui/stage/styles.css'

const interactionController = createStageInteractionController()

<>
  <ComposeComponentPalette
    registry={registry}
    interactionController={interactionController}
  />
  <ComposeStage
    document={runtime.document}
    layoutSnapshot={layoutSnapshot}
    registry={registry}
    assetResolver={assetResolver}
    dispatch={runtime.dispatch}
    viewport={viewport}
    onViewportChange={setViewport}
    tool="select"
    onToolChange={setTool}
    shortcuts={{
      'stage.temporaryPan': [{ code: 'Space' }],
    }}
    selectedIds={selectedIds}
    onSelectedIdsChange={setSelectedIds}
    interactionController={interactionController}
  />
</>
```

`ComposeComponentPalette` 统一消费 Entity Presets，不再有独立 Container/Frame 分支。Palette、
Asset Browser 与 Stage 通过同一实例级 `StageInteractionController` 共享拖入会话；Stage 根据
目标 Entity 是否拥有 `Hierarchy` 选择最深合法父级。

Layout Runtime 加载期间 Stage 呈现 `aria-busy` 并禁用编辑，失败时显示明确错误。Scene DOM 始终
按 Snapshot box 绝对定位；rotation 只进入最终 world matrix/AABB。

Move/Resize/Rotate 查询 `LayoutItem + Transform + Visibility + Lock + GeometryConstraints`。缺少约束时保持
全部可编辑，最小尺寸为 `1×1`；约束可分别禁止移动、旋转，或将 Resize 限制为：

- `free`：八向手柄。
- `preserve-aspect`：仅四角并保持宽高比。
- `horizontal`：仅 E/W。
- `vertical`：仅 N/S。
- `none`：不显示 Resize 手柄。

多选、吸附、矩阵换算、Pointer Capture 和临时 Preview Transform 保持 Stage 会话语义，
pointerup 最多提交一个 `entity.transform.set` 或原子 batch。Container Resize 只改变自身边界，
后代局部 Transform 不变；Core 会再次验证锁定和约束，防止命令绕过 UI。

固定标尺、滚动条、输出边界、网格、辅助线和右键菜单继续由 Stage 提供。快捷键可覆盖适配选择/
Container、缩放、工具、吸附、复制、分组和删除；空数组表示禁用。输入框、contenteditable 和
IME composing 保留原生键盘与右键行为。

`onSurfaceSizeChange` 返回扣除标尺和滚动条后的真实 surface 尺寸，适合宿主适配 Container 或
选择。几何、SceneIndex、命令规划与 interaction controller 从 `@compose-ui/stage-engine` 导出；
多个编辑器实例必须各自创建 controller。
