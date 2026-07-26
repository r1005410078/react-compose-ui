# @compose-ui/components

跨 Compose UI 包复用的无业务 React 组件。首个公共组件 `Tree<T>` 提供受控选择/展开、多选、
Shift 范围选择、键盘导航、Treegrid ARIA、5000+ 节点虚拟化、祖先保留过滤和可选 Pointer 拖排。

```tsx
import { Tree } from '@compose-ui/components'
import '@compose-ui/components/styles.css'

<Tree
  items={items}
  adapter={{
    getId: (item) => item.id,
    getLabel: (item) => item.name,
    getChildren: (item) => item.children,
  }}
  selectedIds={selectedIds}
  expandedIds={expandedIds}
  onSelectionChange={setSelectedIds}
  onExpandedChange={setExpandedIds}
/>
```

本包不包含场景可见性/锁定、资源 Provider、文档命令或持久化。
