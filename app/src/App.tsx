import { OperationLogProvider } from '@compose-ui/operation-log'
import '@compose-ui/operation-log/styles.css'
import '@compose-ui/property-panel/styles.css'
import './App.css'
import { StageDemoWorkspace } from './StageDemo'

function App() {
  return (
    <OperationLogProvider scopeId="compose-ui-full-example">
      <StageDemoWorkspace />
    </OperationLogProvider>
  )
}

export default App
