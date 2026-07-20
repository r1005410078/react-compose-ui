# @compose-ui/editor

可嵌入 React 应用的 Compose UI 编辑器工作区。组件使用 Dockview 提供一个固定的四区
布局：左侧 Scene Graph、中央 Canvas、右侧 Component Inspector，以及共享底部区域的
Transaction Log 与 Command。

## 使用

```tsx
import { ComposeEditor } from '@compose-ui/editor'
import type { SceneTreeOperation } from '@compose-ui/scene-tree'
import '@compose-ui/editor/styles.css'

export function EditorPage() {
  return (
    <ComposeEditor
      style={{ height: 720 }}
      sceneTreeProps={{
        nodes: [{ id: 'page', label: 'Page 1' }],
        selectedIds: [],
        expandedIds: [],
        onOperation: (operation: SceneTreeOperation) => console.log(operation),
      }}
      canvasToolbar={<button>添加组件</button>}
      inspectorPanel={<div>属性</div>}
      transactionLogPanel={<div>事务</div>}
      commandPanel={<input aria-label="命令" />}
    >
      <div>画布内容</div>
    </ComposeEditor>
  )
}
```

必须导入 `@compose-ui/editor/styles.css` 并给 `ComposeEditor` 提供确定的非零高度。
组件保留标准 `<section>` HTML 属性透传，`children` 对应 Canvas 内容。
该样式入口已经包含默认场景树样式；只有独立使用 `@compose-ui/scene-tree` 时才需要另行
导入它的 `styles.css`。

## 布局行为

- Scene Graph、Component Inspector、Transaction Log/Command 使用可缩放、可折叠的
  Dockview Edge Groups。
- Scene Graph 默认显示空 `SceneTree`；`sceneTreeProps` 提供受控状态，原
  `sceneGraphPanel` 插槽仍可完整覆盖默认树。
- Canvas Toolbar 固定在 Canvas 内容顶部，不是独立面板。
- 默认布局禁止面板拖拽、关闭和浮动，Dockview 类型不会成为公共 API。
- 插槽更新不会重建面板或丢失当前实例的尺寸与折叠状态。
- 布局只在当前组件实例存活期间保留，不读取或写入持久化存储。

本版本只提供工作区和内容挂载协议，尚未定义文档 Schema、组件注册、命令模型或数据源
绑定协议。
