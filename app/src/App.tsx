import { ComposeEditor } from '@compose-ui/editor'
import { ComposePreview } from '@compose-ui/preview'
import { useState } from 'react'
import './App.css'

function App() {
  const [textContent, setTextContent] = useState<string | null>(null)
  const [isTextSelected, setIsTextSelected] = useState(false)
  const [command, setCommand] = useState('')

  const addTextComponent = () => {
    setTextContent('默认文本')
    setIsTextSelected(false)
  }

  const selectTextComponent = () => {
    setIsTextSelected(true)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <h1>React Compose UI</h1>
          <span>Page 1</span>
        </div>
        <p>Dockview workspace integration example</p>
      </header>

      <section className="workspace-frame" aria-label="编辑器工作台">
        <ComposeEditor
          className="editor-workspace"
          sceneGraphPanel={
            <div className="scene-panel">
              <div className="panel-search">搜索节点</div>
              <div className="scene-page">
                <span aria-hidden="true">⌄</span>
                <strong>Page 1</strong>
              </div>
              {textContent === null ? (
                <p className="empty-message">暂无组件</p>
              ) : (
                <button
                  className={isTextSelected ? 'scene-node is-selected' : 'scene-node'}
                  type="button"
                  onClick={selectTextComponent}
                >
                  <span aria-hidden="true">T</span>
                  {textContent}
                </button>
              )}
            </div>
          }
          canvasToolbar={
            <div className="canvas-tools">
              <button className="tool-button is-active" type="button">
                选择
              </button>
              <button className="tool-button" type="button">
                平移
              </button>
              <span className="tool-divider" />
              <button
                className="add-button"
                type="button"
                onClick={addTextComponent}
              >
                添加文本组件
              </button>
              <span className="zoom-value">100%</span>
            </div>
          }
          inspectorPanel={
            <div className="inspector-panel">
              {isTextSelected && textContent !== null ? (
                <>
                  <div className="inspector-heading">
                    <span className="node-icon">T</span>
                    <div>
                      <strong>{textContent}</strong>
                      <span>文本组件</span>
                    </div>
                  </div>
                  <div className="property-section">
                    <strong>Content</strong>
                    <label className="property-field">
                      <span>文本内容</span>
                      <input
                        value={textContent}
                        onChange={(event) => setTextContent(event.target.value)}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <p className="empty-message">选择画布中的组件以编辑属性</p>
              )}
            </div>
          }
          transactionLogPanel={
            <ol className="transaction-list">
              <li>
                <span>workspace.ready</span>
                <time>当前会话</time>
              </li>
              {textContent !== null ? (
                <li>
                  <span>component.text.update</span>
                  <time>{textContent}</time>
                </li>
              ) : null}
            </ol>
          }
          commandPanel={
            <form className="command-form" onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="workspace-command">输入编辑器命令</label>
              <div>
                <span aria-hidden="true">›</span>
                <input
                  id="workspace-command"
                  value={command}
                  placeholder="例如：add text"
                  onChange={(event) => setCommand(event.target.value)}
                />
              </div>
            </form>
          }
        >
          <section aria-label="编辑画布" className="editor-canvas">
            <div className="canvas-grid" aria-hidden="true" />
            {textContent === null ? (
              <span className="canvas-empty">点击工具栏按钮添加组件</span>
            ) : (
              <button
                className="text-node"
                type="button"
                onClick={selectTextComponent}
              >
                {textContent}
              </button>
            )}
          </section>
        </ComposeEditor>
      </section>

      <ComposePreview className="preview-panel">
        <div className="preview-heading">
          <strong>Preview</strong>
          <span>@compose-ui/preview 实时同步</span>
        </div>
        <div className="preview-surface">
          <div className="preview-canvas">
            {textContent === null ? (
              <span>等待编辑器内容</span>
            ) : (
              <p>{textContent}</p>
            )}
          </div>
        </div>
      </ComposePreview>
    </main>
  )
}

export default App
