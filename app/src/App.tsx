import { ComposeEditor } from '@compose-ui/editor'
import { ComposePreview } from '@compose-ui/preview'
import './App.css'

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">MONOREPO INTEGRATION EXAMPLE</p>
        <h1>React Compose UI</h1>
        <p>
          The editor and preview below are imported through their public workspace
          package entrypoints.
        </p>
      </header>

      <div className="package-grid">
        <ComposeEditor className="package-card">
          <strong>@compose-ui/editor</strong>
          <span>Editor package mounted</span>
        </ComposeEditor>
        <ComposePreview className="package-card">
          <strong>@compose-ui/preview</strong>
          <span>Preview package mounted</span>
        </ComposePreview>
      </div>
    </main>
  )
}

export default App
