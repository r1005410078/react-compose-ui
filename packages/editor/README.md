# @compose-ui/editor

可嵌入 React 应用的 Compose UI 编辑器工作区。Dockview 布局包含共享左侧 Edge Group 的
Scene Graph/Component Library、中央 Stage、右侧 Component Inspector，以及共享底部区域的
Transaction Log/Command/Assets。

## 使用

```tsx
import { createComposeComponentRegistry } from '@compose-ui/component-registry'
import { createTransactionRuntime } from '@compose-ui/core'
import { createComposeAssetResolver } from '@compose-ui/assets'
import { ComposeEditor, useComposeEditorController } from '@compose-ui/editor'
import { useState } from 'react'
import '@compose-ui/editor/styles.css'

export function EditorPage() {
  const [runtime] = useState(() => createTransactionRuntime({ document }))
  const [registry] = useState(() => createComposeComponentRegistry(definitions))
  const [assetResolver] = useState(() => createComposeAssetResolver(assetProvider))
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
      assets={{ browser: { provider: assetProvider }, resolver: assetResolver }}
      slots={{ transactionLog: <ComposeOperationLogPanel /> }}
    />
  )
}
```

必须导入 `@compose-ui/editor/styles.css` 并给 `ComposeEditor` 提供确定的非零高度。
组件保留标准 `<section>` HTML 属性透传；工作区覆盖内容通过 `slots` 提供。
该样式入口包含默认 ComposeSceneTree、ComposeHistoryPanel、Stage、ComposeComponentPalette 与 ComposeCommandPanel 样式。
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
`locale` prop；第一方组件不再提供独立 locale 覆盖。

## Controller

`useComposeEditorController` 组合宿主提供的 `TransactionRuntime` 与 `ComposeComponentRegistry`，管理
selection、expandedIds、viewport、tool、真实 Stage surface 尺寸和实例级
`StageInteractionController`。Editor 拥有该 controller，并把同一实例交给 Stage 与 Palette；
卸载时统一 dispose。它从 runtime 当前文档派生：

- `sceneTree` 与 `stageProps`
- `history`（直接复用 runtime 的兼容导航协议）
- ComposeComponentPalette、definition/Container Inspector、ComposeCommandPanel 与 Stage Toolbar 内容
- 默认中央 Stage

ComposeSceneTree、Inspector、Stage 与 ComposeCommandPanel 均向同一 runtime 派发。成功命令、undo、redo 和
navigate 通过唯一 `onTransaction` observer 发布；observer 的异常或 Promise rejection 不会回滚
事务。noop、rejected 与 reset 不调用该 observer。

## 布局行为

- Scene Graph/Component Library、Component Inspector、Transaction Log/Command 使用可缩放、可折叠的
  Dockview Edge Groups。
- Assets 与 Transaction Log、Command 共享底部 Edge Group，默认 inactive；`assets.browser`
  组合默认 `ComposeAssetBrowser`，`slots.assetBrowser` 可完整覆盖且优先。
- 默认 ComposeAssetBrowser 的兼容图片拖拽会映射到当前 Editor 独有的 interaction controller。
  显式 `assets.resolver` 优先；省略时 Editor 会从支持稳定引用的 `assets.browser.provider`
  自动创建 resolver。自定义 `slots.assetBrowser` 由宿主自行桥接拖拽和 resolver。
- Scene Graph 与 Component Library 共享左侧组，Scene Graph 初始活动。
- Scene Graph 默认显示空 `ComposeSceneTree`；`sceneTree` 提供受控状态，
  `slots.sceneGraph` 可完整覆盖默认树。
- 提供 `history` 或显式 `slots.history` 时，Scene Graph 外层面板内部才挂载子 Dockview；场景树
  与 History 分别使用上、下两个真实 Dockview 面板，默认比例为 60%/40%，通过原生 sash 调整。
- `history` 默认渲染独立包的 `ComposeHistoryPanel` 并驱动编辑器范围快捷键；`slots.history` 可完整
  覆盖下方内容，但不会关闭 `history` 的快捷键处理。
- Stage Toolbar 固定在 Canvas 内容顶部，不是独立面板；使用 `slots.stageToolbar` 覆盖。
- 默认 Stage Toolbar 提供网格吸附、智能吸附快捷开关和画布设置弹层。弹层只编辑 X/Y
  步长、X/Y 偏移、主线间隔、节点/辅助线吸附并清空辅助线；Apply 最多提交一个事务，
  Cancel 不修改文档。
- Stage 的透明输出边界始终显示 1 屏幕像素边框。点击边界会清空节点选择并在右侧 Properties
  中打开 Canvas Inspector；输出尺寸是一个 `Size` 属性，预设、W/H 在同一属性区内。尺寸可选择
  1280×720、1366×768、1440×900、1920×1080、2560×1440、3840×2160，也可输入任意合法
  自定义值；手动尺寸不再匹配预设时显示 custom。背景使用仅展示色块的 `Color` Picker，支持
  不透明颜色和 `transparent`；旧 CSS 色值在未编辑前仍保持原值。每次有效编辑仍只派发一次可逆
  `output.configure`。该检查目标不进入 ComposeSceneTree 或 `selectedIds`。
- fit Frame/selection 使用 Stage 实际上报的 surface 尺寸，不包含固定标尺和滚动条占用。
- 默认布局禁止面板拖拽、关闭和浮动，Dockview 类型不会成为公共 API。
- 插槽更新不会重建面板或丢失当前实例的尺寸与折叠状态。
- 主题和语言更新只刷新内建 chrome，不重建 Dockview group/panel；根节点提供
  `data-compose-theme` 与 `lang`。
- 布局只在当前组件实例存活期间保留，不读取或写入持久化存储。

提供 controller 且没有显式覆盖时，工作区自动显示 Palette、派生 ComposeSceneTree、Stage、
ComposeHistoryPanel、Inspector 与 ComposeCommandPanel。显式 `slots.stage` 覆盖默认 Stage；无 controller
时既有受控插槽和快捷键行为保持兼容。编辑器不依赖 operation-log，也不会持久化文档或会话状态。
网格、输出设置和全局辅助线属于 `ComposeDocument`，因此会进入 runtime History 和宿主 Operation Log；
viewport、选择、工具、surface 尺寸与滚动范围仍只存在于当前编辑器会话。
