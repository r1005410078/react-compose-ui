import type { ComposeLibraryPort, ComposeLibraryRecord } from '@compose-ui/library'
import { normalizeComposeAssetError } from '@compose-ui/assets'
import { useEffect, useId, useRef, useState } from 'react'
import type { ComposeLibraryMessages } from '../library-i18n'
import { useThumbnail } from '../library-wall/use-thumbnail'

/**
 * 「就用这个」。
 *
 * @remarks
 * 它做的是**复制一份**：客户指中的这张成为你自己那一份的底，此后两边再无关系。
 *
 * **只问一个必须问的问题——它叫什么。**客户就在旁边等着；分类、落点这些之后都能改，而在这一步
 * 问它们只是让用户在客户面前多停留几秒。
 *
 * 图墙上那颗按钮与演示屏上那颗落到**同一条路径**（都开这个框），否则两处迟早行为不同。
 * @internal
 */
export function InstantiateDialog({
  source,
  port,
  messages,
  onDone,
  onClose,
}: {
  readonly source: ComposeLibraryRecord
  readonly port: ComposeLibraryPort
  readonly messages: ComposeLibraryMessages
  readonly onDone: (record: ComposeLibraryRecord) => void
  readonly onClose: () => void
}) {
  const titleId = useId()
  const nameId = useId()
  const [name, setName] = useState(source.title)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const thumbnail = useThumbnail(port, source)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = async () => {
    const title = name.trim()
    if (title === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      const created = await port.instantiate?.({ sourcePageKey: source.pageKey, title })
      if (created !== undefined) onDone(created)
    }
    catch (cause) {
      setError(normalizeComposeAssetError(cause).message)
      setBusy(false)
    }
  }

  return (
    <div
      className="compose-library__scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="compose-library__dialog"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }}
        role="dialog"
      >
        <div className="compose-library__dialog-head">
          <b id={titleId}>{messages.instantiateTitle}</b>
        </div>
        <div className="compose-library__dialog-body">
          <div className="compose-library__dialog-hero">
            <div className="compose-library__dialog-thumb">
              {thumbnail === null
                ? null
                : <img alt="" src={thumbnail} />}
            </div>
            <div>
              <b>{source.title}</b>
              <p>{messages.instantiateHint}</p>
            </div>
          </div>
          <div className="compose-library__field">
            <label htmlFor={nameId}>{messages.instantiateName}</label>
            <input
              id={nameId}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submit()
              }}
              ref={inputRef}
              value={name}
            />
          </div>
          {error === null ? null : (
            <p className="compose-library__error" role="alert">{error}</p>
          )}
        </div>
        <div className="compose-library__dialog-foot">
          <span className="compose-library__tools-spacer" />
          <button className="compose-library__button" onClick={onClose} type="button">
            {messages.cancel}
          </button>
          <button
            className="compose-library__button compose-library__button--primary"
            disabled={busy || name.trim() === ''}
            onClick={() => void submit()}
            type="button"
          >
            {messages.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
