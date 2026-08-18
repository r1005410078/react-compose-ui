import type { ComposeAppearance } from '@compose-ui/core'

/** Container 内置尺寸。 @internal */
export const DEFAULT_CONTAINER_SIZE = Object.freeze({ width: 320, height: 240 })

/**
 * Container 内置外观。
 *
 * @remarks
 * 默认深色：大屏页面几乎都是深色底，浅色默认让每个新容器都要先改一次背景；深于画布底色
 * 才能读成「一块屏」而不是画布本身。
 * @internal
 */
export const DEFAULT_CONTAINER_APPEARANCE: ComposeAppearance = Object.freeze({
  backgroundPaint: { kind: 'solid', color: '#1e2229' },
  borderColor: '#3b4250',
  borderWidth: 1,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
} satisfies ComposeAppearance)
