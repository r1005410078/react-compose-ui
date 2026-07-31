import type { ComposeMeasureConstraint, ComposeMeasuredSize } from '@compose-ui/core'

/** 对具备宽高比的固有尺寸应用 Yoga measure constraints。 @internal */
export function constrainIntrinsicSize(
  intrinsic: { readonly width: number; readonly height: number },
  width: ComposeMeasureConstraint,
  height: ComposeMeasureConstraint,
): ComposeMeasuredSize {
  let nextWidth = intrinsic.width
  let nextHeight = intrinsic.height
  const ratio = intrinsic.width > 0 && intrinsic.height > 0
    ? intrinsic.width / intrinsic.height
    : 1

  if (width.mode === 'exactly') {
    nextWidth = width.value
    if (height.mode !== 'exactly') nextHeight = nextWidth / ratio
  }
  if (height.mode === 'exactly') {
    nextHeight = height.value
    if (width.mode !== 'exactly') nextWidth = nextHeight * ratio
  }
  const widthScale = width.mode === 'at-most' && nextWidth > width.value
    ? width.value / nextWidth
    : 1
  const heightScale = height.mode === 'at-most' && nextHeight > height.value
    ? height.value / nextHeight
    : 1
  const scale = Math.min(widthScale, heightScale)
  if (scale < 1) {
    nextWidth *= scale
    nextHeight *= scale
  }
  return { width: nextWidth, height: nextHeight }
}
