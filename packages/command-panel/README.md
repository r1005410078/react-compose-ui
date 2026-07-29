# @compose-ui/command-panel

`@compose-ui/command-panel` 是订阅 `@compose-ui/core` TransactionRuntime 的独立 React 调试台。
它显示 committed、noop 与 rejected 命令，并可展开查看事务来源、目标及 forward/inverse
Patch；也可以通过宿主提供的结构化预设派发命令。面板不解析自然语言、不执行脚本，也不拥有
页面文档或历史。

```tsx
import { ComposeCommandPanel } from '@compose-ui/command-panel'
import '@compose-ui/command-panel/styles.css'

<ComposeCommandPanel
  runtime={runtime}
  presets={[{
    id: 'rename',
    label: '重命名',
    fields: [{ name: 'name', label: '名称', type: 'string', required: true }],
    createCommand: ({ name }) => ({
      id: crypto.randomUUID(),
      type: 'entity.name.set',
      payload: { entityId: 'heading', name },
      meta: { label: '重命名', source: 'command-panel', targetIds: ['heading'] },
    }),
  }]}
/>
```

通过 `ComposeUIProvider` 设置 zh-CN 或 en-US；它只翻译内建状态、详情、验证、空状态和 ARIA。
命令 label/type、source、字段 label 与选项保持宿主原文。
