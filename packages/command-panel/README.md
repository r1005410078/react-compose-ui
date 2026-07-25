# @compose-ui/command-panel

`@compose-ui/command-panel` 是订阅 `@compose-ui/core` TransactionRuntime 的独立 React 调试台。
它显示 committed、noop 与 rejected 命令，并可展开查看事务来源、目标及 forward/inverse
Patch；也可以通过宿主提供的结构化预设派发命令。面板不解析自然语言、不执行脚本，也不拥有
页面文档或历史。

```tsx
import { CommandPanel } from '@compose-ui/command-panel'
import '@compose-ui/command-panel/styles.css'

<CommandPanel
  locale="zh-CN"
  runtime={runtime}
  presets={[{
    id: 'rename',
    label: '重命名',
    fields: [{ name: 'name', label: '名称', type: 'string', required: true }],
    createCommand: ({ name }) => ({
      id: crypto.randomUUID(),
      type: 'node.rename',
      payload: { nodeId: 'heading', name },
      meta: { label: '重命名', source: 'command-panel', targetIds: ['heading'] },
    }),
  }]}
/>
```

`locale` 支持 zh-CN 和 en-US，只翻译内建状态、详情、验证、空状态和 ARIA；命令 label/type、
source、字段 label 与选项保持宿主原文。未提供 `locale` 时优先读取
`@compose-ui/ui-context`；显式 prop 优先于 Context，Provider 外保持原独立默认语言。
