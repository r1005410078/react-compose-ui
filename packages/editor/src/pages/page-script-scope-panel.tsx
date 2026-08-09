import { useSyncExternalStore } from 'react'
import type { ComposePageScriptScope } from '@compose-ui/script-runtime'

const EMPTY_SNAPSHOT = { exports: [], diagnostics: [], disposed: false } as const
const subscribeEmpty = () => () => undefined
const getEmptySnapshot = () => EMPTY_SNAPSHOT

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  }
  catch {
    return String(value)
  }
}

/** 当前页面 setup 返回成员与运行诊断。 @internal */
export function PageScriptScopePanel({ scope }: { readonly scope?: ComposePageScriptScope }) {
  const snapshot = useSyncExternalStore(
    scope?.subscribe ?? subscribeEmpty,
    scope?.getSnapshot ?? getEmptySnapshot,
    scope?.getSnapshot ?? getEmptySnapshot,
  )
  return (
    <section aria-label="页面脚本作用域" className="compose-editor__page-script-scope">
      <h3>页面脚本</h3>
      {!scope ? <p>当前页面未运行 setup 脚本</p> : null}
      {snapshot.exports.length > 0 ? (
        <dl>
          {snapshot.exports.map((item) => (
            <div key={item.name}>
              <dt>{item.name}</dt>
              <dd>{item.kind === 'method' ? 'method' : displayValue(item.value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {snapshot.diagnostics.map((diagnostic, index) => (
        <p key={`${diagnostic.code}:${index}`} role="alert">
          {diagnostic.message}
        </p>
      ))}
    </section>
  )
}
