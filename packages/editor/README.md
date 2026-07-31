# @compose-ui/editor

可嵌入 React 应用的 Compose UI 编辑器工作区。默认布局组合 Scene Tree、History、Entity
Palette、Stage、聚合 Inspector、Command Panel、Operation Log 插槽与 Assets。

```tsx
import { createComposeAssetResolver } from '@compose-ui/assets'
import { createTransactionRuntime } from '@compose-ui/core'
import { ComposeEditor, useComposeEditorController } from '@compose-ui/editor'
import { createComposeBasicMaterials } from '@compose-ui/materials'
import { useState } from 'react'
import '@compose-ui/editor/styles.css'

export function EditorPage() {
  const [runtime] = useState(() => createTransactionRuntime({ document }))
  const [materials] = useState(() => createComposeBasicMaterials())
  const [assetResolver] = useState(() => createComposeAssetResolver(assetProvider))
  const controller = useComposeEditorController({
    runtime,
    registry: materials.registry,
    onTransaction: (event) => operationLog.record(toLogRecord(event)),
  })

  return (
    <ComposeEditor
      controller={controller}
      style={{ height: 720 }}
      assets={{ browser: { provider: assetProvider }, resolver: assetResolver }}
    />
  )
}
```

必须导入 `@compose-ui/editor/styles.css` 并提供非零高度。Controller 拥有一个实例级
`StageInteractionController` 与文档会话级 Layout Runtime，从当前 `ComposeDocument v6` 派生 Scene Tree、
Palette、Stage、History、Inspector 和 Command Panel，并把所有编辑入口接到同一事务时间线。

Scene Tree 根据 `rootIds` 和 `Hierarchy.childIds` 生成。Palette 只显示 Registry Presets。
Scene Tree 移入带 Layout 的父级会自动转 Flow，跨 Layout 保持 Flow 与目标 insertion index，移出到
自由父级时使用当前 Snapshot 烘焙 Absolute；同一 Layout 内排序只改变 `Hierarchy.childIds`。
Controller 拥有文档会话级 Layout Runtime；Stage surface 挂载时用 registry、asset resolver 与 page
loader 创建 measurement adapter，卸载时 detach。测量 revision 只更新 Snapshot，不进入事务、历史
或操作日志。
默认 Inspector 只创建一个 Property Panel，并按 Registry 顺序聚合 Identity、Transform、
LayoutItem、Visibility、Lock、Appearance、Hierarchy/Clip、GeometryConstraints 与 Renderer 内容分组。
所有分组共享搜索、筛选、显示设置和列宽，默认展开且可折叠；Hierarchy 与 Clip 合并为“容器”，
未知 Component/Renderer 使用同一分组样式降级展示。

Inspector 顶部“添加能力”使用 Registry 的依赖和冲突规划，已附加能力可以经确认框移除。锁定
Entity 时只有 Lock 保持可编辑，以便解锁；其他 Component、Renderer 内容和能力操作只读。

Canvas 输出仍是独立检查目标，不进入 Entity 选择或 Scene Tree。它保留单行 Map 输出尺寸和共享
Color Picker。选择、展开、viewport、工具、检查目标和临时能力菜单状态都属于 Editor 会话，
不会写入 `ComposeDocument`。

设置中心提供主题、语言与快捷键重绑。Stage 的“适配容器”动作使用 `stage.fitContainer`；
History 和右键菜单都显示当前实例实际生效的键位。偏好默认只存在当前 Editor 实例，不访问
`localStorage`，也不进入 History。

`onTransaction` 是成功 commit/undo/redo/navigate 的唯一外部观察边界。Observer 异常不会回滚
已提交事务；noop、rejected 与 reset 不触发它。文档持久化、审计和资源写入仍由宿主负责。

默认 Dockview 布局禁止面板关闭、浮动与任意拖拽。宿主可以通过 `slots` 覆盖领域区域；Editor
不依赖 operation-log，也不会把 Dockview 类型或示例应用状态暴露为公共 API。
