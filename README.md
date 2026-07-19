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
bun add @compose-ui/editor @compose-ui/preview
```

也可以使用 npm：

```bash
npm install @compose-ui/editor @compose-ui/preview
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

export function ComposePage() {
  return (
    <main>
      <ComposeEditor className="editor-panel">
        编辑器挂载区域
      </ComposeEditor>

      <ComposePreview className="preview-panel">
        预览器挂载区域
      </ComposePreview>
    </main>
  )
}
```

`ComposeEditor` 和 `ComposePreview` 当前接受标准的 HTML `section` 属性，包括
`className`、`style`、事件和 `children`。

```tsx
<ComposeEditor
  className="editor"
  style={{ minHeight: 480 }}
  aria-label="页面编辑器"
>
  自定义编辑器内容
</ComposeEditor>
```

当前版本尚未提供稳定的文档数据、`value`、`onChange`、组件注册或数据源绑定 API。

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

1. 点击“添加文本组件”。
2. 点击画布中的“默认文本”。
3. 在“文本内容”输入框中修改文字。
4. 查看 Preview 区域实时同步结果。

该流程用于验证组件挂载和浏览器操作测试，不代表最终编辑器交互设计。

## 查看可视化 E2E 测试

打开 Playwright 测试界面：

```bash
bun run test:e2e:ui
```

在测试面板中选择：

```text
adds a text component and updates the preview
```

可以查看“添加组件、选择组件、修改属性、Preview 同步”的每一步浏览器操作和 DOM
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
- 画布拖拽、缩放、对齐和图层
- 属性配置器
- 数据源绑定和表达式
- 撤销、重做、复制和粘贴
- 页面保存、加载和生产发布协议

这些接口会在后续规范确定后逐步加入；请不要依赖示例应用内部的临时状态结构。
