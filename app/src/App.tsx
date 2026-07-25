import { OperationLogProvider } from '@compose-ui/operation-log'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import '@compose-ui/operation-log/styles.css'
import '@compose-ui/property-panel/styles.css'
import './App.css'
import { StageDemoWorkspace } from './StageDemo'

const hostMessageOverrides = {
  'editor.settings': '偏好设置',
} as const

function App() {
  const demonstrateMessageOverrides = new URLSearchParams(window.location.search)
    .has('message-overrides')

  return (
    <ComposeUIProvider
      messages={demonstrateMessageOverrides ? hostMessageOverrides : undefined}
    >
      <OperationLogProvider scopeId="compose-ui-full-example">
        <StageDemoWorkspace />
      </OperationLogProvider>
    </ComposeUIProvider>
  )
}

export default App
