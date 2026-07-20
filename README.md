# React Compose UI

React Compose UI 是一组可嵌入 React 项目的低代码 UI 组件，面向需要在客户现场快速搭建
和调整定制化数据大屏的实施工程师与前端开发者。

它希望把重复的大屏页面开发工作转化为可视化操作，让使用者能够添加组件、调整配置并
实时查看最终效果，减少现场修改代码、重新构建和部署的次数。

> 当前版本处于基础能力验证阶段，仅提供编辑器、预览器挂载组件和最小操作演示，尚不是
> 完整的低代码编辑器。

## 环境要求

- React 18.3 或 React 19
- ReactDOM 18.3 或 ReactDOM 19
- 使用 ESM 的前端构建环境

仓库本地开发使用 Bun 1.3.14。

## 安装

相关包发布到 npm 后，可以安装需要的组件：

```bash
bun add @compose-ui/editor @compose-ui/scene-tree @compose-ui/preview
```

也可以使用 npm：

```bash
npm install @compose-ui/editor @compose-ui/scene-tree @compose-ui/preview
```

React 和 ReactDOM 由宿主项目提供：

```bash
bun add react react-dom
```

仓库开发阶段请使用下方“运行仓库示例”的方式，不要假设 npm 中已经存在尚未发布的版本。

## 在 React 中使用

```tsx
import { ComposeEditor } from '@compose-ui/editor'
import { ComposePreview } from '@compose-ui/preview'
import type { SceneTreeOperation } from '@compose-ui/scene-tree'
import '@compose-ui/editor/styles.css'

export function ComposePage() {
  return (
    <main>
      <ComposeEditor
        className="editor-panel"
        sceneTreeProps={{
          nodes: [{ id: 'page', label: 'Page 1' }],
          selectedIds: [],
          expandedIds: [],
          onOperation: (operation: SceneTreeOperation) => console.log(operation),
        }}
        canvasToolbar={<CanvasTools />}
        inspectorPanel={<PropertyInspector />}
        transactionLogPanel={<TransactionLog />}
        commandPanel={<CommandInput />}
      >
        <Canvas />
      </ComposeEditor>

      <ComposePreview className="preview-panel">
        预览器挂载区域
      </ComposePreview>
    </main>
  )
}
```

`ComposeEditor` 使用 Dockview 提供固定的 IDE 式工作区：Scene Graph 位于左侧 Edge
Group，Canvas 位于中央主组，Component Inspector 位于右侧 Edge Group，Transaction
Log 与 Command 共享底部 Edge Group。三个边缘区可以调整尺寸，并通过活动标签折叠或
展开。

宿主必须显式导入 `@compose-ui/editor/styles.css`，并为编辑器提供确定的非零高度。
`ComposeEditor` 接受标准的 HTML `section` 属性；`children` 渲染为中央画布内容。
Scene Graph 默认使用 `@compose-ui/scene-tree`，通过 `sceneTreeProps` 接收受控状态；
`sceneGraphPanel` 仍可完整覆盖默认树，其余四个命名属性提供其他工作区内容。

```tsx
<ComposeEditor
  className="editor"
  style={{ height: 720 }}
  aria-label="页面编辑器"
  sceneTreeProps={{
    nodes: [{ id: 'page', label: 'Page 1' }],
    selectedIds: [],
    expandedIds: [],
  }}
  canvasToolbar={<button>添加组件</button>}
  inspectorPanel={<div>选择组件后显示属性</div>}
  transactionLogPanel={<div>暂无事务</div>}
  commandPanel={<input aria-label="命令" />}
>
  <div>自定义画布内容</div>
</ComposeEditor>
```

Dockview 是 editor 包的内部实现，公共入口不会导出 Dockview API、面板对象或布局 JSON。
当前实例中的尺寸、折叠状态和活动标签会在挂载期间保留，但不会写入 localStorage、页面
文档或远端存储；重新挂载后恢复默认布局。

当前版本仍未提供稳定的文档数据、`value`、`onChange`、组件注册或数据源绑定 API。

## 独立使用场景树

```tsx
import { SceneTree, useSceneTreeCommands } from '@compose-ui/scene-tree'
import '@compose-ui/scene-tree/styles.css'

<SceneTree
  nodes={nodes}
  selectedIds={selectedIds}
  expandedIds={expandedIds}
  onSelectionChange={(ids) => setSelectedIds([...ids])}
  onExpandedChange={(ids) => setExpandedIds([...ids])}
  onOperation={handleOperation}
/>
```

`useSceneTreeCommands({ nodes, selectedIds, onOperation })` 可供外部工具栏和 `SceneTree` 的
`commands` 属性共享新增、删除、复制、剪切和树内粘贴状态。复制粘贴发出 `duplicate` 意图，
宿主负责生成新 ID 和克隆业务数据；剪切粘贴发出 `move`。该剪贴板不使用系统剪贴板且不持久化。

外部工具栏可以直接通过 controller 请求新增节点：

```tsx
const commands = useSceneTreeCommands({ nodes, selectedIds, onOperation })

<button
  disabled={!commands.isEnabled('create-suggested')}
  onClick={() => commands.execute('create-suggested')}
>
  新增节点
</button>

<SceneTree {...treeProps} commands={commands} />
```

`create-child`、`create-sibling` 和 `create-root` 可以显式指定子级、兄弟或根级位置；
`create-suggested` 会根据最近选择自动决定位置。新增只发出 `create` 操作意图，宿主必须处理
其中的 `parentId` 和 `index`、生成稳定 ID，并更新受控 `nodes`。完整示例和 `targetId` 规则见
[`@compose-ui/scene-tree` README](./packages/scene-tree/README.md#从外部新增节点)。

场景树通过 `@tanstack/react-virtual` 支持完全展开的 5000 个节点，检索支持大小写敏感、
Unicode 全词和正则表达式。组件仅发出操作意图，不拥有文档 Schema、持久化或撤销状态。
拖拽期间节点保持静止，蓝色横线显示最终插入位置；Shift 选择的多个节点可以按原顺序
一起移动，横向移动指针可以调整目标层级，松手后才发出 `move` 操作意图。
节点聚焦后，macOS 和 Linux 使用 Enter 开始重命名，Windows 使用 F2；双击不会进入
重命名状态。

## 运行仓库示例

安装依赖：

```bash
bun install --frozen-lockfile
```

启动开发环境：

```bash
bun run dev
```

终端会显示 Vite 示例应用地址。打开页面后可以体验当前的最小流程：

1. 在 Canvas Toolbar 点击“添加文本组件”。
2. 点击中央画布中的“默认文本”。
3. 在右侧 Component 面板的“文本内容”输入框中修改文字。
4. 观察画布、Scene Graph、Component 和 Transaction Log 同步更新。
5. 拖动边缘区分隔线调整尺寸，或点击 Edge Group 的活动标签折叠与展开。

该流程用于验证组件挂载和浏览器操作测试，不代表最终编辑器交互设计。

## 查看可视化 E2E 测试

打开 Playwright 测试界面：

```bash
bun run test:e2e:ui
```

在测试面板中选择：

```text
adds and edits a text component inside the editor
```

可以查看“添加组件、选择组件、修改属性、编辑器区域同步”的每一步浏览器操作和 DOM
快照。

无界面运行全部 E2E：

```bash
bun run test:e2e
```

## 开发检查

```bash
# ESLint
bun run lint

# TypeScript
bun run typecheck

# Vitest
bun run test

# 构建示例应用和所有包
bun run build

# 检查 npm 包内容
bun run pack:dry-run
```

提交改动前建议依次运行：

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:e2e
```

## 当前限制

当前版本还没有正式提供：

- 页面文档 Schema 和版本迁移
- 组件物料注册
- 画布节点拖拽、缩放、对齐和图层编辑
- 属性配置器
- 数据源绑定和表达式
- 撤销、重做以及跨页面或系统剪贴板复制粘贴
- 页面保存、加载和生产发布协议
- 工作区布局持久化、自定义面板注册和浮动窗口

这些接口会在后续规范确定后逐步加入；请不要依赖示例应用内部的临时状态结构。
