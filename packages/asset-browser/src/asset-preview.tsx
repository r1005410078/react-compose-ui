import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import {
  ComposeButton,
  ComposeDialog,
  ComposeDialogBackdrop,
  ComposeDialogContent,
  ComposeDialogDescription,
  ComposeDialogFooter,
  ComposeDialogHeader,
  ComposeDialogPortal,
  ComposeDialogTitle,
  ComposeDialogViewport,
} from '@compose-ui/components'
import {
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import type { ComposeAssetEntry, ComposeAssetProvider } from '@compose-ui/assets'
import { normalizeComposeAssetError } from '@compose-ui/assets'
import { ScriptEditor } from './script-editor'
import type { ComposeScriptEditorHandle } from './script-editor'
import {
  extensionOf,
  formatAssetSize,
  isImageAsset,
  isScriptAsset,
} from './asset-file-utils'
import { useAssetRead } from './use-asset-read'
import { getAssetBrowserMessages } from './asset-browser-i18n'
import type { ComposeScriptIntelligenceProfile } from './script-intelligence'

function useBlobUrl(blob: Blob | undefined) {
  const url = useMemo(() => blob ? URL.createObjectURL(blob) : null, [blob])
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}

/** 资源预览的 imperative 保存接口。 @public */
export interface ComposeAssetPreviewHandle {
  /** 保存脚本草稿；非脚本资源始终成功且不会产生写入。 */
  save(): Promise<boolean>
}

/** 可独立置于资源文档中的安全资源预览属性。 @public */
export interface ComposeAssetPreviewProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onError'> {
  readonly entry: ComposeAssetEntry
  readonly provider: ComposeAssetProvider
  /**
   * 只读模式。
   *
   * @remarks
   * 只影响脚本分支：为 true 时禁止输入与写入、不上报 dirty，`save()` 空转成功。
   * 图片与未知文件分支的呈现不受影响。
   * @defaultValue false
   */
  readonly readOnly?: boolean
  /** 为当前脚本资源启用宿主定义的隐藏类型分析。 */
  readonly scriptIntelligence?: ComposeScriptIntelligenceProfile
  /** 脚本 dirty 状态变更。 */
  readonly onDirtyChange?: (dirty: boolean) => void
  /** Provider 成功写入后返回最新条目。 */
  readonly onSaved?: (entry: ComposeAssetEntry) => void
}

/**
 * 渲染显式打开的图片、SVG、脚本或二进制资源。
 *
 * @remarks
 * 组件的读取和 Monaco 生命周期只在它挂载时开始；资源浏览器选择文件不会挂载它。
 *
 * @public
 */
export const ComposeAssetPreview = forwardRef<
  ComposeAssetPreviewHandle,
  ComposeAssetPreviewProps
>(function ComposeAssetPreview({
  entry,
  onDirtyChange = () => undefined,
  onSaved = () => undefined,
  provider,
  readOnly = false,
  scriptIntelligence,
  className,
  ...htmlProps
}, ref) {
  const scriptRef = useRef<ComposeScriptEditorHandle>(null)
  const i18n = useComposeI18nContext()
  const theme = useComposeThemeContext()
  const locale = i18n?.locale ?? 'zh-CN'
  const messages = getAssetBrowserMessages(locale, i18n?.formatMessage)
  const [reloadKey, setReloadKey] = useState(0)
  const [forceContent, setForceContent] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const state = useAssetRead(provider, entry, reloadKey)
  const blobUrl = useBlobUrl(state.status === 'ready' ? state.data?.blob : undefined)

  useImperativeHandle(ref, () => ({
    // 只读预览没有可保存的草稿；空转返回成功，使宿主的关闭确认不会因此卡住。
    save: async () => readOnly ? true : scriptRef.current?.save() ?? true,
  }), [readOnly])

  if (state.status === 'loading' || state.status === 'idle') {
    return <div {...htmlProps} className={['asset-browser__status', className].filter(Boolean).join(' ')}>{messages.loading}</div>
  }
  if (state.status === 'error' || !state.data) {
    return <div {...htmlProps} className={['asset-browser__status', 'asset-browser__status--error', className].filter(Boolean).join(' ')}>{messages.error(state.error ?? '')}</div>
  }
  if (isImageAsset(entry)) {
    return (
      <div {...htmlProps} className={['asset-browser__image-preview', className].filter(Boolean).join(' ')}>
        {blobUrl ? <img alt={entry.name} src={blobUrl} /> : null}
      </div>
    )
  }
  if (isScriptAsset(entry)) {
    return (
      <>
        <ScriptEditor
          ref={scriptRef}
          content={state.data.blob}
          entry={entry}
          loadingLabel={messages.loading}
          providerId={provider.id}
          readOnly={readOnly}
          revision={state.data.revision}
          scriptIntelligence={scriptIntelligence}
          theme={theme?.resolvedTheme ?? 'dark'}
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
          <ComposeDialog
            open
            onOpenChange={(open) => {
              if (!open) setConflict(false)
            }}
          >
            <ComposeDialogPortal>
              <ComposeDialogBackdrop />
              <ComposeDialogViewport>
                <ComposeDialogContent>
                  <ComposeDialogHeader>
                    <ComposeDialogTitle>{messages.conflictTitle}</ComposeDialogTitle>
                    <ComposeDialogDescription>{messages.conflictQuestion}</ComposeDialogDescription>
                  </ComposeDialogHeader>
                  <ComposeDialogFooter>
                <ComposeButton type="button" variant="outline" onClick={() => {
                  setConflict(false)
                  setForceContent(null)
                  setReloadKey((value) => value + 1)
                  onDirtyChange(false)
                }}>{messages.reload}</ComposeButton>
                <ComposeButton type="button" variant="destructive" onClick={() => {
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
                }}>{messages.force}</ComposeButton>
                <ComposeButton type="button" variant="outline" onClick={() => setConflict(false)}>{messages.cancel}</ComposeButton>
                  </ComposeDialogFooter>
                </ComposeDialogContent>
              </ComposeDialogViewport>
            </ComposeDialogPortal>
          </ComposeDialog>
        ) : null}
      </>
    )
  }
  return (
    <div {...htmlProps} className={['asset-browser__binary', className].filter(Boolean).join(' ')}>
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
})

interface AssetThumbnailProps {
  readonly entry: ComposeAssetEntry
  readonly provider: ComposeAssetProvider
  /** 宿主提供的缩略图内容；优先于内建的目录图标与扩展名占位。 */
  readonly fallback?: ReactNode
}

export function AssetThumbnail({ entry, fallback, provider }: AssetThumbnailProps) {
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
      {url ? <img alt="" loading="lazy" src={url} /> : fallback !== undefined && fallback !== null
        ? fallback
        : entry.kind === 'folder' ? (
        <svg viewBox="0 0 48 40">
          <path d="M3 8h17l5 6h20v22H3z" fill="currentColor" opacity=".85" />
          <path d="M3 14h42" fill="none" stroke="currentColor" opacity=".45" />
        </svg>
        ) : <span>{extensionOf(entry.name).toUpperCase() || 'FILE'}</span>}
    </div>
  )
}
