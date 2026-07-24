# @compose-ui/command-panel

`@compose-ui/command-panel` 是订阅 `@compose-ui/core` TransactionRuntime 的独立 React 调试台。
它显示 committed、noop 与 rejected 命令，并可展开查看事务来源、目标及 forward/inverse
Patch；也可以通过宿主提供的结构化预设派发命令。面板不解析自然语言、不执行脚本，也不拥有
页面文档或历史。

```tsx
import { CommandPanel } from '@compose-ui/command-panel'
import '@compose-ui/command-panel/styles.css'

<CommandPanel
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
