import { ComposeOperationLogProvider } from '@compose-ui/operation-log'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import '@compose-ui/materials/styles.css'
import '@compose-ui/chart-materials/styles.css'
import '@compose-ui/operation-log/styles.css'
import '@compose-ui/property-panel/styles.css'
import './App.css'
import { QtReferencePreview } from './QtReferencePreview'
import { StageDemoWorkspace } from './StageDemo'

const hostMessageOverrides = {
  'editor.settings': '偏好设置',
} as const

function App() {
  const search = new URLSearchParams(window.location.search)
  const demonstrateMessageOverrides = search.has('message-overrides')

  // Qt 像素对比的预览一侧：不挂编辑器，只渲染注入的夹具文档。
  if (search.has('qt-reference')) {
    return (
      <ComposeUIProvider>
        <QtReferencePreview />
      </ComposeUIProvider>
    )
  }

  return (
    <ComposeUIProvider
      messages={demonstrateMessageOverrides ? hostMessageOverrides : undefined}
    >
      <ComposeOperationLogProvider scopeId="compose-ui-full-example">
        <StageDemoWorkspace />
      </ComposeOperationLogProvider>
    </ComposeUIProvider>
  )
}

export default App
