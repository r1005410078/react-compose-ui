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

## 实例偏好与设置中心

左侧活动栏底部齿轮会打开当前 Editor 范围内的模态设置弹框。顶部为跨分类搜索，左侧固定
外观、语言和键盘快捷方式分类，右侧修改即时生效；打开时 Dockview 进入 inert 状态。内建设置
支持 Dark、Light、System、简体中文、English，以及 Stage、编辑和历史动作的单次快捷键重绑、
冲突检查、清除和恢复。默认按住 Space 可从 Stage 空白、Frame 或节点开始临时平移；
`Cmd/Ctrl+,` 打开或关闭设置。

```tsx
import {
  ComposeEditor,
  createDefaultComposeEditorPreferences,
} from '@compose-ui/editor'
import { useState } from 'react'

const [preferences, setPreferences] = useState(
  createDefaultComposeEditorPreferences,
)

<ComposeEditor
  controller={controller}
  preferences={preferences}
  onPreferencesChange={setPreferences}
/>
```

提供 `preferences` 时由宿主受控；否则偏好只存在当前 `ComposeEditor` 实例。组件不会访问
`localStorage`，主题、语言和快捷键也不会进入 ComposeDocument、History 或 Operation Log。
`system` 会实时监听 `prefers-color-scheme`。宿主插槽、registry label 与业务组件文案不会被
自动翻译。

Editor 会根据 preferences 自动组合 `@compose-ui/ui-context` Provider，并继承外层宿主的
dark/light token 和稳定 message ID 覆盖。第一方面板直接读取 Context，不再由 Editor clone
`locale` prop；旧 locale prop 仅作为独立组件的显式兼容覆盖保留。

## Controller

`useComposeEditorController` 组合宿主提供的 `TransactionRuntime` 与 `ComponentRegistry`，管理
selection、expandedIds、activeFrameId、viewport、tool、真实 Stage surface 尺寸和实例级
`StageInteractionController`。Editor 拥有该 controller，并把同一实例交给 Stage 与 Palette；
卸载时统一 dispose。它从 runtime 当前文档派生：

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
- 默认 Stage Toolbar 提供网格吸附、智能吸附快捷开关和画布设置弹层。弹层可编辑 X/Y
  步长、X/Y 偏移、主线间隔、节点/辅助线吸附并清空辅助线；Apply 最多提交一个事务，
  Cancel 不修改文档。
- fit Frame/selection 使用 Stage 实际上报的 surface 尺寸，不包含固定标尺和滚动条占用。
- 默认布局禁止面板拖拽、关闭和浮动，Dockview 类型不会成为公共 API。
- 插槽更新不会重建面板或丢失当前实例的尺寸与折叠状态。
- 主题和语言更新只刷新内建 chrome，不重建 Dockview group/panel；根节点提供
  `data-compose-theme` 与 `lang`。
- 布局只在当前组件实例存活期间保留，不读取或写入持久化存储。

提供 controller 且没有显式覆盖时，工作区自动显示 Palette、派生 SceneTree、Stage、
HistoryPanel、Inspector 与 CommandPanel。显式 `children` 始终覆盖默认 Stage；无 controller
时既有受控插槽和快捷键行为保持兼容。编辑器不依赖 operation-log，也不会持久化文档或会话状态。
网格设置和全局辅助线属于 `ComposeDocument`，因此会进入 runtime History 和宿主 Operation Log；
viewport、选择、工具、surface 尺寸与滚动范围仍只存在于当前编辑器会话。
