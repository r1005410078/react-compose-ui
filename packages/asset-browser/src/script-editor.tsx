import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { ComposeAssetEntry } from '@compose-ui/assets'
import { getAssetScriptLanguage } from './script-language'

interface ScriptEditorProps {
  readonly content: Blob
  readonly entry: ComposeAssetEntry
  readonly providerId: string
  readonly revision: string
  readonly loadingLabel: string
  readonly theme: 'dark' | 'light'
  /**
   * 只读模式：禁止输入与写入，不注册保存快捷键，也不上报脏状态。
   *
   * @defaultValue false
   */
  readonly readOnly?: boolean
  readonly onDirtyChange: (dirty: boolean) => void
  readonly onSave: (
    content: string,
    expectedRevision: string,
    force?: boolean,
  ) => Promise<boolean>
}

/** @internal 资源预览通过此接口协调脚本保存。 */
export interface ComposeScriptEditorHandle {
  save(): Promise<boolean>
}

export const ScriptEditor = forwardRef<ComposeScriptEditorHandle, ScriptEditorProps>(function ScriptEditor({
  content,
  entry,
  onDirtyChange,
  onSave,
  providerId,
  revision,
  loadingLabel,
  readOnly = false,
  theme,
}: ScriptEditorProps, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const saveRef = useRef(onSave)
  const revisionRef = useRef(revision)
  const executeSaveRef = useRef<(() => Promise<boolean>) | null>(null)
  const setThemeRef = useRef<((theme: 'dark' | 'light') => void) | null>(null)
  const initialThemeRef = useRef(theme)
  // Monaco 实例在挂载时按只读状态创建；切换只读需要重建编辑器，因此这里只取初始值。
  const readOnlyRef = useRef(readOnly)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    saveRef.current = onSave
  }, [onSave])

  useEffect(() => {
    revisionRef.current = revision
  }, [revision])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let cleanup = () => undefined
    void Promise.all([
      import('./monaco-runtime'),
      content.text(),
    ]).then(([runtime, text]) => {
      if (disposed) return
      const monaco = runtime.getMonaco()
      const uri = monaco.Uri.parse(
        `compose-asset://${encodeURIComponent(providerId)}/${encodeURIComponent(entry.id)}`,
      )
      monaco.editor.getModel(uri)?.dispose()
      const model = monaco.editor.createModel(text, getAssetScriptLanguage(entry.name), uri)
      const editor = monaco.editor.create(host, {
        model,
        automaticLayout: false,
        minimap: { enabled: false },
        // domReadOnly 一并关闭 contenteditable，使宿主无法绕过 Monaco 的只读检查直接输入。
        readOnly: readOnlyRef.current,
        domReadOnly: readOnlyRef.current,
        theme: initialThemeRef.current === 'dark' ? 'vs-dark' : 'vs',
      })
      setThemeRef.current = (nextTheme) => {
        monaco.editor.setTheme(nextTheme === 'dark' ? 'vs-dark' : 'vs')
      }
      let baseline = model.getValue()
      // 只读模式不订阅内容变更、不注册保存快捷键：没有可保存的改动，脏状态永远为 false。
      const change = readOnlyRef.current
        ? null
        : model.onDidChangeContent(() => {
            onDirtyChange(model.getValue() !== baseline)
          })
      const save = async () => {
        if (readOnlyRef.current) return true
        const saved = await saveRef.current(model.getValue(), revisionRef.current)
        if (!saved) return false
        baseline = model.getValue()
        onDirtyChange(false)
        return true
      }
      executeSaveRef.current = save
      if (!readOnlyRef.current) {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          void save()
        })
      }
      const observer = typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => editor.layout())
      observer?.observe(host)
      setLoading(false)
      cleanup = () => {
        observer?.disconnect()
        change?.dispose()
        editor.dispose()
        model.dispose()
        executeSaveRef.current = null
        setThemeRef.current = null
        onDirtyChange(false)
      }
    })
    return () => {
      disposed = true
      cleanup()
    }
  }, [content, entry.id, entry.name, onDirtyChange, providerId])

  useEffect(() => {
    setThemeRef.current?.(theme)
  }, [theme])

  useImperativeHandle(ref, () => ({
    save: async () => executeSaveRef.current?.() ?? false,
  }), [])

  return (
    <div className="asset-browser__script">
      {loading ? <div className="asset-browser__status">{loadingLabel}</div> : null}
      <div ref={hostRef} className="asset-browser__monaco" data-testid="asset-monaco-host" />
    </div>
  )
})
