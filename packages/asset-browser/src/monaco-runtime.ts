import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution'
import 'monaco-editor/esm/vs/language/css/monaco.contribution'
import 'monaco-editor/esm/vs/language/html/monaco.contribution'
import 'monaco-editor/esm/vs/language/json/monaco.contribution'
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker&inline'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker&inline'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline'
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&inline'

export function getMonaco() {
  const globalScope = globalThis as typeof globalThis & {
    MonacoEnvironment?: {
      getWorker?: (_moduleId: string, label: string) => Worker
    }
  }
  if (!globalScope.MonacoEnvironment) {
    globalScope.MonacoEnvironment = {
      getWorker: (_moduleId, label) => {
        if (label === 'json') return new JsonWorker()
        if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
        if (label === 'typescript' || label === 'javascript') return new TypeScriptWorker()
        return new EditorWorker()
      },
    }
  }
  return monaco
}
