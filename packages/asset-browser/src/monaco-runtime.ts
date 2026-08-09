// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Vite 的 Monaco ESM 子路径需要本地 ambient module 声明。
/// <reference path="./monaco-editor.d.ts" />

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution'
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution'
import 'monaco-editor/esm/vs/language/css/monaco.contribution'
import 'monaco-editor/esm/vs/language/html/monaco.contribution'
import 'monaco-editor/esm/vs/language/json/monaco.contribution'
import * as monacoTypeScript from 'monaco-editor/esm/vs/language/typescript/monaco.contribution'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker&inline'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker&inline'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline'
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&inline'
import { createComposeScriptIntelligenceSession as createIntelligenceSession } from './script-intelligence/monaco-script-intelligence'
import type { ComposeScriptIntelligenceProfile } from './script-intelligence'

type MonacoTypeScriptApi = typeof import('monaco-editor')['typescript']
type LoadableMonacoLanguage = import('monaco-editor').languages.ILanguageExtensionPoint & {
  readonly loader?: () => Promise<{
    readonly conf?: import('monaco-editor').languages.LanguageConfiguration
    readonly language?: import('monaco-editor').languages.IMonarchLanguage
  }>
}

let intelligentJavaScriptRegistered = false

/** @internal */
export const COMPOSE_INTELLIGENT_JAVASCRIPT_LANGUAGE = 'compose-intelligent-javascript'

/** 为可见 Setup model 注册复用 JavaScript Monarch tokenizer 的隔离语言。 @internal */
export function prepareComposeIntelligentJavaScript() {
  if (intelligentJavaScriptRegistered) return
  intelligentJavaScriptRegistered = true
  monaco.languages.register({ id: COMPOSE_INTELLIGENT_JAVASCRIPT_LANGUAGE })
  const javascript = monaco.languages.getLanguages().find(
    ({ id }) => id === 'javascript',
  ) as LoadableMonacoLanguage | undefined
  monaco.languages.registerTokensProviderFactory(
    COMPOSE_INTELLIGENT_JAVASCRIPT_LANGUAGE,
    {
      create: async () => {
        const loaded = await javascript?.loader?.()
        if (!loaded?.language) {
          throw new Error('Monaco JavaScript tokenizer is unavailable.')
        }
        return loaded.language
      },
    },
  )
  void javascript?.loader?.().then((loaded) => {
    const configuration = loaded.conf
    if (configuration) {
      monaco.languages.setLanguageConfiguration(
        COMPOSE_INTELLIGENT_JAVASCRIPT_LANGUAGE,
        configuration,
      )
    }
  })
}

/** @internal */
export function createComposeScriptIntelligenceSession(options: {
  readonly model: import('monaco-editor').editor.ITextModel
  readonly profile: ComposeScriptIntelligenceProfile
}) {
  return createIntelligenceSession({
    ...options,
    monaco,
    typescript: monacoTypeScript as unknown as MonacoTypeScriptApi,
  })
}

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
