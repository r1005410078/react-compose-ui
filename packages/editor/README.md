# @compose-ui/editor

可嵌入 React 应用的 Compose UI 编辑器工作区。默认布局组合 Scene Tree、History、Entity
Palette、Stage、聚合 Inspector、Command Panel、Operation Log 插槽与 Assets。

```tsx
import { createComposeAssetResolver } from '@compose-ui/assets'
import { createComposeComponentStore } from '@compose-ui/component-library'
import { createTransactionRuntime } from '@compose-ui/core'
import {
  ComposeEditor,
  useComposeEditorController,
  type ComposeEditorActiveComponentSession,
} from '@compose-ui/editor'
import { createComposeBasicMaterials } from '@compose-ui/materials'
import { useState } from 'react'
import '@compose-ui/editor/styles.css'

export function EditorPage() {
  const [rootRuntime] = useState(() => createTransactionRuntime({ document }))
  const [activeComponent, setActiveComponent]
    = useState<ComposeEditorActiveComponentSession | null>(null)
  const runtime = activeComponent?.runtime ?? rootRuntime
  const [materials] = useState(() => createComposeBasicMaterials())
  const [assetResolver] = useState(() => createComposeAssetResolver(assetProvider))
  const [componentStore] = useState(() => createComposeComponentStore({ provider: assetProvider }))
  const controller = useComposeEditorController({
    runtime,
    registry: materials.registry,
    componentStore,
    onTransaction: (event) => operationLog.record(toLogRecord(event)),
  })

  return (
    <ComposeEditor
      controller={controller}
      components={{ store: componentStore, onActiveSessionChange: setActiveComponent }}
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

配置 `componentStore` 后，组件库同时显示代码 Preset、项目 Base 和 Variant。Stage、Scene Tree
右键菜单与 Command Panel 共享“创建组件…”命名流程；Scene Tree 普通行也可拖到可写资源目录。
资源写入成功后才提交一次场景替换，资源失败时场景保持不变；并发文档变化或场景提交失败时保留
已创建资源并报告“已保存但未实例化”。Undo/Redo 只往返场景，不删除项目文件。

双击 Base/Variant 会打开独立 TransactionRuntime 标签。宿主必须用
`components.onActiveSessionChange` 将活动组件 runtime 交给 Controller，与页面标签的接线方式一致。
Variant 与实例 Inspector 提供单项/全部 Apply、Revert 与从实例创建 Variant。组件源保存后依赖实例
自动同步，只有覆盖失效时才要求确认。父源写入成功而当前层保存失败时不会破坏性回滚，并明确显示
partial success。

选中实例时 Inspector 由两部分拼成：宿主实体提供名称、位置与旋转，组件根提供布局、外观与裁剪。
根侧通过 `hiddenComponentKeys`/`hideIdentity` 隐藏重复项，避免同一属性出现两次且取值互相矛盾。
默认 Inspector 只创建一个 Property Panel，并按 Registry 元数据聚合。Identity 与标记为
`inspectorGroup: 'basic'` 的领域 Inspector 共用“基础”；Layout 默认展开，Visibility、Lock、
Appearance、Hierarchy/Clip、GeometryConstraints 与 Renderer 声明的 Props 分类等其他分组按各自
元数据决定初始展开状态；未分类 Renderer Props 进入“高级”。
所有分组共享搜索、筛选、显示设置和列宽；Hierarchy 与 Clip 合并为“容器”，未知
Component/Renderer 使用同一分组样式降级展示。

Inspector 顶部“添加能力”使用 Registry 的依赖和冲突规划，已附加能力可以经确认框移除。锁定
Entity 时只有 Lock 保持可编辑，以便解锁；其他 Component、Renderer Props 和能力操作只读。

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

启用 `pages` 后，页面标签保存完整 `ComposePageFile` 聚合并保留 setup 引用。Canvas Inspector 将
“页面脚本”作为输出尺寸、背景旁的全宽可折叠属性：可以从页面同目录选择 `.setup.js`、按页面名
快捷创建，并从更多菜单打开或解除当前关联；标题栏可手动重新加载当前脚本，紧凑成员表显示 Runtime 返回成员、
实时值与诊断。资源菜单保留等价入口；
Provider 缺少创建或写入能力时只禁用对应操作。Renderer Prop Contract 绑定仍写入可撤销的
`Bindings` Component，并合并进 Renderer Definition 声明的 Props 分类：自定义 Inspector 通过无
Property Panel 依赖的端口内联第一层 value 字段入口，method 或无字面 editor 的 Contract 在所属分类
显示 binding-only 行。未分类 Contract 与旧 Inspector 位于“高级”，没有未分类内容时不显示该分组；
不再存在通用“内容”或独立“数据绑定”分组。Entity 锁定时全部绑定操作禁用。宿主切换 controller
时应同时传入 `activePage.runtime` 与
`activePage.scriptScope`。脚本是受信任同 Realm JavaScript，不是沙箱，也不编译 TypeScript。

页面能力启用时，通过页面菜单打开或文件名匹配 `*.setup.js` 的资源会话会启用隐藏类型层。用户仍编辑
原始 JavaScript：Editor 只在 Asset Browser 的 shadow model 中加入 `@ts-check`、Runtime `.d.ts` 与
setup 参数类型，因此 `ctx.`、State/Computed `.value` 和返回对象可以获得 Monaco 提示。标准导出支持
`export function setup(ctx)`、箭头函数和函数表达式三种形式；无法识别时给出非阻断提示并保留普通
JavaScript 编辑。语法或类型 marker 不参与保存判断，Provider 永远不会收到隐藏声明。
