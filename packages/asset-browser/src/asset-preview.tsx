import { useEffect, useMemo, useState } from 'react'
import type { ComposeAssetEntry, ComposeAssetProvider } from './asset-types'
import type { AssetBrowserMessages } from './asset-browser-i18n'
import { normalizeComposeAssetError } from './asset-operations'
import { ScriptEditor } from './script-editor'
import {
  extensionOf,
  formatAssetSize,
  isImageAsset,
  isScriptAsset,
} from './asset-file-utils'
import { useAssetRead } from './use-asset-read'

function useBlobUrl(blob: Blob | undefined) {
  const url = useMemo(() => blob ? URL.createObjectURL(blob) : null, [blob])
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}

interface AssetPreviewProps {
  readonly entry: ComposeAssetEntry
  readonly locale: string
  readonly messages: AssetBrowserMessages
  readonly provider: ComposeAssetProvider
  readonly saveRequest?: number
  readonly theme: 'dark' | 'light'
  readonly onDirtyChange: (dirty: boolean) => void
  readonly onSaved: (entry: ComposeAssetEntry) => void
}

export function AssetPreview({
  entry,
  locale,
  messages,
  onDirtyChange,
  onSaved,
  provider,
  saveRequest,
  theme,
}: AssetPreviewProps) {
  const [reloadKey, setReloadKey] = useState(0)
  const [forceContent, setForceContent] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const state = useAssetRead(provider, entry, reloadKey)
  const blobUrl = useBlobUrl(state.status === 'ready' ? state.data?.blob : undefined)

  if (state.status === 'loading' || state.status === 'idle') {
    return <div className="asset-browser__status">{messages.loading}</div>
  }
  if (state.status === 'error' || !state.data) {
    return <div className="asset-browser__status asset-browser__status--error">{messages.error(state.error ?? '')}</div>
  }
  if (isImageAsset(entry)) {
    return (
      <div className="asset-browser__image-preview">
        {blobUrl ? <img alt={entry.name} src={blobUrl} /> : null}
      </div>
    )
  }
  if (isScriptAsset(entry)) {
    return (
      <>
        <ScriptEditor
          content={state.data.blob}
          entry={entry}
          loadingLabel={messages.loading}
          providerId={provider.id}
          revision={state.data.revision}
          saveRequest={saveRequest}
          theme={theme}
          onDirtyChange={onDirtyChange}
          onSave={async (content, expectedRevision, force = false) => {
            if (!provider.writeFile) return false
            try {
              const saved = await provider.writeFile({
                fileId: entry.id,
                content: new Blob([content], { type: entry.mediaType }),
                expectedRevision,
                force,
              })
              onSaved(saved)
              setConflict(false)
              setForceContent(null)
              return true
            } catch (error) {
              const normalized = normalizeComposeAssetError(error)
              if (normalized.code === 'conflict') {
                setConflict(true)
                setForceContent(content)
                return false
              }
              throw error
            }
          }}
        />
        {conflict ? (
          <div
            aria-labelledby="asset-conflict-title"
            aria-modal="true"
            className="asset-browser__dialog-layer asset-browser__dialog-layer--conflict"
            role="alertdialog"
          >
            <div className="asset-browser__dialog">
              <h3 id="asset-conflict-title">{messages.conflictTitle}</h3>
              <p>{messages.conflictQuestion}</p>
              <div className="asset-browser__dialog-actions">
                <button type="button" onClick={() => {
                  setConflict(false)
                  setForceContent(null)
                  setReloadKey((value) => value + 1)
                  onDirtyChange(false)
                }}>{messages.reload}</button>
                <button type="button" onClick={() => {
                  if (forceContent !== null) {
                    void provider.writeFile?.({
                      fileId: entry.id,
                      content: new Blob([forceContent], { type: entry.mediaType }),
                      expectedRevision: state.data?.revision ?? '',
                      force: true,
                    }).then((saved) => {
                      onSaved(saved)
                      setConflict(false)
                      setForceContent(null)
                      onDirtyChange(false)
                    })
                  }
                }}>{messages.force}</button>
                <button type="button" onClick={() => setConflict(false)}>{messages.cancel}</button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    )
  }
  return (
    <div className="asset-browser__binary">
      <strong>{entry.name}</strong>
      <p>{messages.binary}</p>
      <dl>
        <dt>{messages.type}</dt><dd>{entry.mediaType ?? 'application/octet-stream'}</dd>
        <dt>{messages.size}</dt><dd>{formatAssetSize(entry.size, locale)}</dd>
        <dt>{messages.modified}</dt>
        <dd>{entry.modifiedAt ? new Intl.DateTimeFormat(locale).format(entry.modifiedAt) : '—'}</dd>
      </dl>
      {blobUrl ? <a download={entry.name} href={blobUrl}>{messages.download}</a> : null}
    </div>
  )
}

interface AssetThumbnailProps {
  readonly entry: ComposeAssetEntry
  readonly provider: ComposeAssetProvider
}

export function AssetThumbnail({ entry, provider }: AssetThumbnailProps) {
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined')
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!element || visible || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((records) => {
      if (records.some((record) => record.isIntersecting)) setVisible(true)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element, visible])
  const state = useAssetRead(provider, visible && isImageAsset(entry) ? entry : undefined)
  const url = useBlobUrl(state.status === 'ready' ? state.data?.blob : undefined)
  return (
    <div ref={setElement} aria-hidden="true" className="asset-browser__thumbnail">
      {url ? <img alt="" loading="lazy" src={url} /> : entry.kind === 'folder' ? (
        <svg viewBox="0 0 48 40">
          <path d="M3 8h17l5 6h20v22H3z" fill="currentColor" opacity=".85" />
          <path d="M3 14h42" fill="none" stroke="currentColor" opacity=".45" />
        </svg>
      ) : <span>{extensionOf(entry.name).toUpperCase() || 'FILE'}</span>}
    </div>
  )
}
