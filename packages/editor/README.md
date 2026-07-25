# @compose-ui/editor

可嵌入 React 应用的 Compose UI 编辑器工作区。Dockview 布局包含共享左侧 Edge Group 的
Scene Graph/Component Library、中央 Stage、右侧 Component Inspector，以及共享底部区域的
Transaction Log/Command。

## 使用

```tsx
import { createComponentRegistry } from '@compose-ui/component-registry'
import { createTransactionRuntime } from '@compose-ui/core'
import { ComposeEditor, useComposeEditorController } from '@compose-ui/editor'
import { useState } from 'react'
import '@compose-ui/editor/styles.css'

export function EditorPage() {
  const [runtime] = useState(() => createTransactionRuntime({ document }))
  const [registry] = useState(() => createComponentRegistry(definitions))
  const controller = useComposeEditorController({
    runtime,
    registry,
    framePresets,
    containerInspector: ContainerInspector,
    onTransaction: (event) => operationLog.record(toLogRecord(event)),
  })

  return (
    <ComposeEditor
      controller={controller}
      style={{ height: 720 }}
      transactionLogPanel={<OperationLogPanel />}
    />
  )
}
```

必须导入 `@compose-ui/editor/styles.css` 并给 `ComposeEditor` 提供确定的非零高度。
组件保留标准 `<section>` HTML 属性透传，`children` 对应 Canvas 内容。
该样式入口包含默认 SceneTree、HistoryPanel、Stage、ComponentPalette 与 CommandPanel 样式。
只有独立使用这些包时才需要另行导入对应的 `styles.css`。

## Controller

`useComposeEditorController` 组合宿主提供的 `TransactionRuntime` 与 `ComponentRegistry`，管理
selection、expandedIds、activeFrameId、viewport、tool 和实例级 `StageDragController`。它从
runtime 当前文档派生：

- `sceneTreeProps` 与 `stageProps`
- `history`（直接复用 runtime 的兼容导航协议）
- ComponentPalette、definition/Container Inspector、CommandPanel 与 Stage Toolbar 内容
- 默认中央 Stage

SceneTree、Inspector、Stage 与 CommandPanel 均向同一 runtime 派发。成功命令、undo、redo 和
navigate 通过唯一 `onTransaction` observer 发布；observer 的异常或 Promise rejection 不会回滚
事务。noop、rejected 与 reset 不调用该 observer。

## 布局行为

- Scene Graph/Component Library、Component Inspector、Transaction Log/Command 使用可缩放、可折叠的
  Dockview Edge Groups。
- Scene Graph 与 Component Library 共享左侧组，Scene Graph 初始活动。
- Scene Graph 默认显示空 `SceneTree`；`sceneTreeProps` 提供受控状态，原
  `sceneGraphPanel` 插槽仍可完整覆盖默认树。
- 提供 `history` 或显式 `historyPanel` 时，Scene Graph 外层面板内部才挂载子 Dockview；场景树
  与 History 分别使用上、下两个真实 Dockview 面板，默认比例为 60%/40%，通过原生 sash 调整。
- `history` 默认渲染独立包的 `HistoryPanel` 并驱动编辑器范围快捷键；`historyPanel` 可完整
  覆盖下方内容，但不会关闭 `history` 的快捷键处理。
- Stage Toolbar 固定在 Canvas 内容顶部，不是独立面板；`stageToolbar` 优先于已废弃的
  `canvasToolbar`。
- 默认布局禁止面板拖拽、关闭和浮动，Dockview 类型不会成为公共 API。
- 插槽更新不会重建面板或丢失当前实例的尺寸与折叠状态。
- 布局只在当前组件实例存活期间保留，不读取或写入持久化存储。

提供 controller 且没有显式覆盖时，工作区自动显示 Palette、派生 SceneTree、Stage、
HistoryPanel、Inspector 与 CommandPanel。显式 `children` 始终覆盖默认 Stage；无 controller
时既有受控插槽和快捷键行为保持兼容。编辑器不依赖 operation-log，也不会持久化文档或会话状态。
