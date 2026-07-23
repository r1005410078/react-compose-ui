# @compose-ui/history

独立的 React 会话历史包，提供不可变快照时间线、撤销/重做快捷键与受控历史面板。它不依赖
`@compose-ui/core`、`@compose-ui/editor`、`@compose-ui/scene-tree` 或
`@compose-ui/property-panel`，可单独嵌入任意 React 宿主。

## 使用

```tsx
import {
  HistoryPanel,
  useHistory,
  useHistoryShortcuts,
} from '@compose-ui/history'
import '@compose-ui/history/styles.css'

interface DocumentSnapshot {
  title: string
  nodes: readonly { id: string; label: string }[]
}

export function DocumentEditor() {
  const history = useHistory<DocumentSnapshot>({
    title: '未命名页面',
    nodes: [],
  })
  const onKeyDownCapture = useHistoryShortcuts(history)

  return (
    <section onKeyDownCapture={onKeyDownCapture}>
      <input
        value={history.value.title}
        onChange={(event) => {
          const title = event.target.value
          history.commit(
            (current) => ({ ...current, title }),
            { label: '修改页面名称', mergeKey: 'page:title' },
          )
        }}
      />
      <HistoryPanel controller={history} />
    </section>
  )
}
```

`useHistory` 默认保留 100 个动作，初始基线不计入上限；超过容量后最早可达状态显示为
“较早状态”。相同 `mergeKey` 且 750ms 内的连续提交会合并，未提供 `mergeKey` 的提交各自形成
记录。在历史中间提交新值会删除后续重做分支。

快捷键支持 `Cmd/Ctrl+Z`、`Cmd/Ctrl+Shift+Z` 和 `Ctrl+Y`。处理器应挂在编辑器范围容器上，
因此输入框聚焦时仍操作文档历史；IME 组合输入期间不会拦截。

## 快照约束

历史只存活于当前 Hook 实例，不读取或写入持久化存储。包会保留宿主提交的值引用，不做隐式
深拷贝；宿主必须以不可变方式更新快照，且传给 `commit` 的更新函数必须无副作用。加载另一份
文档时应显式调用 `history.reset(nextDocument, '开始')`。

`HistoryPanel` 只依赖 `HistoryNavigationController`，因此未来基于 Transaction/inverse 的历史
实现也可以复用同一个面板协议。
