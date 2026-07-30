import type {
  ComposePaintImageLibrary,
  ComposePaintImageOption,
} from '@compose-ui/components'
import type {
  ComposeAssetEntry,
  ComposeAssetProvider,
} from '@compose-ui/assets'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const IMAGE_EXTENSION = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i
const PREVIEW_CONCURRENCY = 4

type ImageLibraryState = {
  readonly images: readonly ComposePaintImageOption[]
  readonly status: NonNullable<ComposePaintImageLibrary['status']>
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('The operation was aborted', 'AbortError')
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** 只把可识别且带稳定引用键的文件纳入图片扫描。 @internal */
export function isProviderImageEntry(entry: ComposeAssetEntry) {
  if (entry.kind !== 'file' || !entry.assetKey) return false
  if (entry.mediaType) return entry.mediaType.startsWith('image/')
  return IMAGE_EXTENSION.test(entry.name)
}

/** 为同目录重复上传生成最小可用数字后缀。 @internal */
export function uniqueProviderAssetName(
  requestedName: string,
  existingNames: readonly string[],
) {
  const normalized = requestedName.trim() || 'image'
  const occupied = new Set(existingNames)
  if (!occupied.has(normalized)) return normalized
  const extensionIndex = normalized.lastIndexOf('.')
  const hasExtension = extensionIndex > 0
  const base = hasExtension ? normalized.slice(0, extensionIndex) : normalized
  const extension = hasExtension ? normalized.slice(extensionIndex) : ''
  let suffix = 2
  while (occupied.has(`${base}-${suffix}${extension}`)) suffix += 1
  return `${base}-${suffix}${extension}`
}

async function listProviderImages(
  provider: ComposeAssetProvider,
  signal: AbortSignal,
) {
  const queue = [provider.root.id]
  const visited = new Set<string>()
  const images: ComposeAssetEntry[] = []
  while (queue.length > 0) {
    throwIfAborted(signal)
    const folderId = queue.shift()
    if (!folderId || visited.has(folderId)) continue
    visited.add(folderId)
    const entries = await provider.list({ folderId, signal })
    for (const entry of entries) {
      if (entry.kind === 'folder') queue.push(entry.id)
      else if (isProviderImageEntry(entry)) images.push(entry)
    }
  }
  return images.sort((left, right) =>
    (right.modifiedAt ?? 0) - (left.modifiedAt ?? 0)
    || left.name.localeCompare(right.name)
    || left.id.localeCompare(right.id))
}

async function resolveProviderImages(
  provider: ComposeAssetProvider,
  entries: readonly ComposeAssetEntry[],
  signal: AbortSignal,
) {
  const options: Array<ComposePaintImageOption | undefined> = Array(entries.length)
  const objectUrls: string[] = []
  let cursor = 0
  let failures = 0
  const worker = async () => {
    while (cursor < entries.length) {
      const index = cursor
      const entry = entries[index]
      cursor += 1
      if (!entry?.assetKey) continue
      try {
        throwIfAborted(signal)
        const resolved = await provider.resolveAsset!({
          assetKey: entry.assetKey,
          signal,
        })
        throwIfAborted(signal)
        const mediaType = resolved.mediaType || resolved.blob.type
        if (!mediaType.startsWith('image/')) continue
        const previewUrl = URL.createObjectURL(resolved.blob)
        objectUrls.push(previewUrl)
        options[index] = {
          asset: {
            providerId: provider.id,
            assetKey: entry.assetKey,
            scope: provider.referenceScope ?? 'persistent',
          },
          label: entry.name,
          previewUrl,
        }
      }
      catch (error) {
        if (isAbortError(error) || signal.aborted) throw error
        failures += 1
      }
    }
  }
  try {
    await Promise.all(
      Array.from(
        { length: Math.min(PREVIEW_CONCURRENCY, entries.length) },
        () => worker(),
      ),
    )
  }
  catch (error) {
    objectUrls.forEach((url) => URL.revokeObjectURL(url))
    throw error
  }
  const resolvedOptions = options.filter(
    (option): option is ComposePaintImageOption => option !== undefined,
  )
  if (entries.length > 0 && resolvedOptions.length === 0 && failures > 0) {
    throw new Error('No provider image could be resolved')
  }
  return { objectUrls, options: resolvedOptions }
}

/**
 * 把 Editor 已连接的 Asset Provider 适配为 Components 图片端口。
 *
 * @internal
 */
export function useProviderPaintImageLibrary({
  enabled,
  provider,
  uploadParentId,
}: {
  readonly enabled: boolean
  readonly provider?: ComposeAssetProvider
  readonly uploadParentId?: string
}): ComposePaintImageLibrary | undefined {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<ImageLibraryState>({
    images: [],
    status: 'idle',
  })
  const uploadObjectUrls = useRef(new Set<string>())
  const supported = Boolean(
    provider?.capabilities.reference
    && provider.resolveAsset,
  )

  const retry = useCallback(() => {
    setRevision((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!enabled || !provider?.subscribe || !supported) return undefined
    return provider.subscribe(() => {
      setRevision((current) => current + 1)
    })
  }, [enabled, provider, supported])

  useEffect(() => {
    if (!enabled || !provider || !supported) return undefined
    const controller = new AbortController()
    let objectUrls: readonly string[] = []
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setState((current) => ({ images: current.images, status: 'loading' }))
      }
    })
    void listProviderImages(provider, controller.signal)
      .then((entries) => resolveProviderImages(provider, entries, controller.signal))
      .then((result) => {
        objectUrls = result.objectUrls
        setState({ images: result.options, status: 'ready' })
      })
      .catch((error: unknown) => {
        if (!isAbortError(error) && !controller.signal.aborted) {
          setState({ images: [], status: 'error' })
        }
      })
    return () => {
      controller.abort()
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [enabled, provider, revision, supported])

  useEffect(() => () => {
    uploadObjectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    uploadObjectUrls.current.clear()
  }, [provider])

  const upload = useCallback(async (file: File) => {
    if (
      !provider
      || !supported
      || !provider.capabilities.createFile
      || !provider.createFile
    ) return null
    const parentId = uploadParentId ?? provider.root.id
    const siblings = await provider.list({ folderId: parentId })
    const name = uniqueProviderAssetName(
      file.name,
      siblings.map((entry) => entry.name),
    )
    const entry = await provider.createFile({
      parentId,
      name,
      content: file,
    })
    if (!entry.assetKey) throw new Error('Uploaded asset has no stable key')
    const previewUrl = URL.createObjectURL(file)
    uploadObjectUrls.current.add(previewUrl)
    setRevision((current) => current + 1)
    return {
      asset: {
        providerId: provider.id,
        assetKey: entry.assetKey,
        scope: provider.referenceScope ?? 'persistent',
      },
      label: entry.name,
      previewUrl,
    }
  }, [provider, supported, uploadParentId])

  return useMemo(() => {
    if (!enabled || !provider) return undefined
    return {
      images: supported ? state.images : [],
      status: supported ? state.status : 'unsupported',
      onRetry: retry,
      onUpload: supported
        && provider.capabilities.createFile
        && provider.createFile
        ? upload
        : undefined,
    }
  }, [enabled, provider, retry, state.images, state.status, supported, upload])
}
