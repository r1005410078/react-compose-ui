import type {
  ComposeAssetReference,
  ComposeAssetResolver,
  ComposeResolvedAsset,
} from '@compose-ui/assets'
import { useEffect, useMemo, useState } from 'react'

interface ResolvedAssetState {
  readonly referenceKey: string
  readonly resolver: ComposeAssetResolver
  readonly result:
    | { readonly status: 'ready'; readonly value: ComposeResolvedAsset }
    | { readonly status: 'error' }
}

/** 从未知 JSON props 中读取严格资源引用。 @internal */
export function readAssetReference(value: unknown): ComposeAssetReference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Readonly<Record<string, unknown>>
  if (
    typeof record.providerId !== 'string'
    || typeof record.assetKey !== 'string'
    || (record.scope !== 'persistent' && record.scope !== 'session')
  ) return null
  return {
    providerId: record.providerId,
    assetKey: record.assetKey,
    scope: record.scope,
  }
}

/** 订阅 resolver 并取消迟到结果。 @internal */
export function useResolvedAsset(
  reference: ComposeAssetReference | null,
  resolver?: ComposeAssetResolver,
) {
  const assetKey = reference?.assetKey
  const providerId = reference?.providerId
  const scope = reference?.scope
  const stableReference = useMemo(() => (
    assetKey && providerId && scope ? { assetKey, providerId, scope } : null
  ), [
    assetKey,
    providerId,
    scope,
  ])
  const referenceKey = stableReference
    ? `${stableReference.providerId}\0${stableReference.assetKey}\0${stableReference.scope}`
    : ''
  const [state, setState] = useState<ResolvedAssetState | null>(null)

  useEffect(() => {
    if (!stableReference || !resolver) return
    const controller = new AbortController()
    let generation = 0
    const load = () => {
      generation += 1
      const currentGeneration = generation
      void resolver.resolve({ reference: stableReference, signal: controller.signal }).then(
        (value) => {
          if (!controller.signal.aborted && currentGeneration === generation) {
            setState({
              referenceKey,
              resolver,
              result: { status: 'ready', value },
            })
          }
        },
        () => {
          if (!controller.signal.aborted && currentGeneration === generation) {
            setState({
              referenceKey,
              resolver,
              result: { status: 'error' },
            })
          }
        },
      )
    }
    load()
    const unsubscribe = resolver.subscribe?.(stableReference, load)
    return () => {
      controller.abort()
      unsubscribe?.()
    }
  }, [referenceKey, resolver, stableReference])

  if (!stableReference || !resolver) return { status: 'error' } as const
  if (
    !state
    || state.referenceKey !== referenceKey
    || state.resolver !== resolver
  ) return { status: 'loading' } as const
  return state.result
}

/** 把固有尺寸限制到最长边 512，且不放大小图。 @internal */
export function constrainAssetSize(width: number, height: number) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return { width: 320, height: 180 }
  }
  const scale = Math.min(1, 512 / Math.max(width, height))
  return { width: width * scale, height: height * scale }
}

/** 从位图 Blob 读取固有尺寸；不可解码时使用固定回退。 @internal */
export async function measureRasterAsset(blob: Blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      const size = constrainAssetSize(bitmap.width, bitmap.height)
      bitmap.close()
      return size
    } catch {
      // 浏览器不支持该格式时由固定尺寸保证 drop 仍可完成。
    }
  }
  return { width: 320, height: 180 }
}

/** 从 SVG width/height 或 viewBox 读取固有尺寸。 @internal */
export function measureSvgAsset(source: string) {
  try {
    const intrinsic = readSvgIntrinsicSize(source)
    return constrainAssetSize(intrinsic.width, intrinsic.height)
  }
  catch {
    return { width: 320, height: 180 }
  }
}

/** 从 SVG width/height 或 viewBox 读取未经缩放的固有尺寸。 @internal */
export function readSvgIntrinsicSize(source: string) {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  const root = document.documentElement
  const width = Number.parseFloat(root.getAttribute('width') ?? '')
  const height = Number.parseFloat(root.getAttribute('height') ?? '')
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { width, height }
  }
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/u).map(Number)
  const viewBoxWidth = viewBox?.length === 4 ? viewBox[2] ?? 0 : 0
  const viewBoxHeight = viewBox?.length === 4 ? viewBox[3] ?? 0 : 0
  if (viewBoxWidth > 0 && viewBoxHeight > 0) return { width: viewBoxWidth, height: viewBoxHeight }
  throw new Error('SVG 缺少有效的 width/height 或 viewBox')
}
