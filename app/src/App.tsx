import { ComposeOperationLogProvider } from '@compose-ui/operation-log'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import '@compose-ui/materials/styles.css'
import '@compose-ui/operation-log/styles.css'
import '@compose-ui/property-panel/styles.css'
import './App.css'
import { DeepPageSlotDemo } from './DeepPageSlotDemo'
import { StageDemoWorkspace } from './StageDemo'

const hostMessageOverrides = {
  'editor.settings': '偏好设置',
} as const

function App() {
  const search = new URLSearchParams(window.location.search)
  const demonstrateMessageOverrides = search.has('message-overrides')
  const demonstrateDeepPageSlot = search.has('deep-page-slot')

  return (
    <ComposeUIProvider
      messages={demonstrateMessageOverrides ? hostMessageOverrides : undefined}
    >
      <ComposeOperationLogProvider scopeId="compose-ui-full-example">
        {demonstrateDeepPageSlot ? <DeepPageSlotDemo /> : <StageDemoWorkspace />}
      </ComposeOperationLogProvider>
    </ComposeUIProvider>
  )
}

export default App
