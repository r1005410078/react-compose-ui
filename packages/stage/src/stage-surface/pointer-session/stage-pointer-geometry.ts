import type { StagePoint } from '@compose-ui/stage-engine'

/** 归一化后的修饰键；Stage 只关心这三个。 */
export type StageModifiers = { shift: boolean; alt: boolean; command: boolean }

/**
 * 手势开始时冻结的 surface 矩形。
 *
 * @remarks
 * 手势期间 surface 可能因侧栏展开、窗口缩放而移动；坐标基线必须固定在按下当刻，否则同一次
 * 拖拽的世界坐标会在中途整体平移。
 */
export interface FrozenSurfaceRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export function stageElementRect(
  element: HTMLElement,
): DOMRect {
  let rect = element.getBoundingClientRect()
  if (
    rect.width === 0
    && rect.height === 0
    && element.classList.contains('compose-stage__surface')
    && element.parentElement
  ) {
    // JSDOM 不做布局；组件测试仍可通过根元素的显式 rect 验证坐标算法。
    rect = element.parentElement.getBoundingClientRect()
  }
  return rect
}

export function screenPoint(
  event: { clientX: number; clientY: number },
  element: HTMLElement,
): StagePoint {
  const rect = stageElementRect(element)
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

export function frozenSurfaceRect(element: HTMLElement): FrozenSurfaceRect {
  const rect = stageElementRect(element)
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

export function screenPointFromRect(
  event: { clientX: number; clientY: number },
  rect: FrozenSurfaceRect,
): StagePoint {
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

export function pressedButtons(button: number, buttons: number) {
  if (buttons !== 0) return buttons
  if (button === 0) return 1
  if (button === 1) return 4
  if (button === 2) return 2
  return 0
}

export function resolveClientPoint(
  point: StagePoint,
  element: HTMLElement,
): StagePoint | null {
  const rect = stageElementRect(element)
  if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null
  return { x: point.x - rect.left, y: point.y - rect.top }
}

export function modifiers(event: {
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}): StageModifiers {
  return {
    shift: event.shiftKey,
    alt: event.altKey,
    command: event.ctrlKey || event.metaKey,
  }
}
