import { ComposeEditor } from '@compose-ui/editor'
import { ComposePreview } from '@compose-ui/preview'
import { useState } from 'react'
import './App.css'

function App() {
  const [textContent, setTextContent] = useState<string | null>(null)
  const [isTextSelected, setIsTextSelected] = useState(false)

  const addTextComponent = () => {
    setTextContent('默认文本')
    setIsTextSelected(false)
  }

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
          <div className="card-heading">
            <div>
              <strong>@compose-ui/editor</strong>
              <span>最小操作演示</span>
            </div>
            <button className="add-button" type="button" onClick={addTextComponent}>
              添加文本组件
            </button>
          </div>

          <section aria-label="编辑画布" className="editor-canvas">
            {textContent === null ? (
              <span>点击上方按钮添加组件</span>
            ) : (
              <button
                className="text-node"
                type="button"
                onClick={() => setIsTextSelected(true)}
              >
                {textContent}
              </button>
            )}
          </section>

          {isTextSelected && textContent !== null ? (
            <label className="property-field">
              <span>文本内容</span>
              <input
                value={textContent}
                onChange={(event) => setTextContent(event.target.value)}
              />
            </label>
          ) : null}
        </ComposeEditor>
        <ComposePreview className="package-card">
          <div className="card-heading">
            <div>
              <strong>@compose-ui/preview</strong>
              <span>实时预览</span>
            </div>
          </div>
          <div className="preview-canvas">
            {textContent === null ? (
              <span>等待编辑器内容</span>
            ) : (
              <p>{textContent}</p>
            )}
          </div>
        </ComposePreview>
      </div>
    </main>
  )
}

export default App
