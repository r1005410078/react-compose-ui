import type { ComposeDocument } from '@compose-ui/core'
import {
  screenToWorld,
  worldToScreen,
  type ResizeHandle,
  type StageRect,
  type StageViewport,
} from '@compose-ui/stage-engine'

/** 屏幕坐标下的矩形；与世界矩形同形，单位是 CSS 像素。 */
export type StageScreenRect = StageRect

/** 一块场景的屏幕边界；`frameId` 供 Overlay 标注标题。 */
export interface StageFrameScreenBounds extends StageScreenRect {
  readonly frameId: string
}

/** 画布上的一条辅助线；`position` 是世界坐标。 */
export interface StageCanvasGuide {
  readonly id: string
  readonly axis: 'x' | 'y'
  readonly position: number
}

/**
 * 世界矩形换算到屏幕。
 *
 * @remarks
 * 位置走 `worldToScreen`（含平移），尺寸只乘 zoom——平移不改变尺寸，一起走会把原点偏移
 * 算进宽高里。
 */
export function worldRectToScreen(
  rect: StageRect | null,
  viewport: StageViewport,
): StageScreenRect | null {
  if (!rect) return null
  return {
    ...worldToScreen(rect, viewport),
    width: rect.width * viewport.zoom,
    height: rect.height * viewport.zoom,
  }
}

/** 场景索引里需要用到的那一部分；只取世界包围盒，避免把整个索引类型灌进签名。 */
export interface StageWorldBoundsSource {
  readonly getWorldBounds: (entityId: string) => StageRect | null | undefined
}

/**
 * 逐块场景求屏幕边界。
 *
 * @remarks
 * v7 没有文档级输出尺寸，因此没有「唯一那圈边界」可画：每个根 Frame 各自是一块可检查的
 * 区域，逐个求。求不出包围盒的（例如刚建出来还没求解）直接略过而不是画成零尺寸。
 */
export function frameScreenBounds(
  document: ComposeDocument,
  index: StageWorldBoundsSource,
  viewport: StageViewport,
): readonly StageFrameScreenBounds[] {
  return document.rootIds.flatMap((frameId) => {
    const worldBounds = index.getWorldBounds(frameId)
    if (!worldBounds) return []
    const screen = worldRectToScreen(worldBounds, viewport)!
    return [{ frameId, ...screen }]
  })
}

/** 八个缩放手柄在屏幕上的锚点；无选中框时为 null。 */
export function resizeHandlePoints(
  bounds: StageScreenRect | null,
): Readonly<Record<ResizeHandle, readonly [number, number]>> | null {
  if (!bounds) return null
  const { height, width, x, y } = bounds
  return {
    nw: [x, y],
    n: [x + width / 2, y],
    ne: [x + width, y],
    e: [x + width, y + height / 2],
    se: [x + width, y + height],
    s: [x + width / 2, y + height],
    sw: [x, y + height],
    w: [x, y + height / 2],
  }
}

/**
 * 合并已保存的辅助线与拖动中的预览。
 *
 * @remarks
 * 预览按 id 覆盖同一条既有线（拖动中的位置优先），预览里 id 不在既有集合中的则是**正在
 * 新建**的线，追加在后面。两类必须都出现，否则拖出新线的过程中画面上什么都看不到。
 */
export function mergeCanvasGuides(
  worldGuides: readonly StageCanvasGuide[],
  preview: readonly StageCanvasGuide[],
): readonly StageCanvasGuide[] {
  const previewById = new Map(preview.map((guide) => [guide.id, guide]))
  return [
    ...worldGuides.map((guide) => previewById.get(guide.id) ?? guide),
    ...preview.filter((guide) => !worldGuides.some(({ id }) => id === guide.id)),
  ]
}

/** 当前视口覆盖的世界矩形；滚动范围以它为可见窗口。 */
export function visibleWorldRect(
  viewport: StageViewport,
  surfaceSize: { readonly width: number; readonly height: number },
): StageRect {
  return {
    ...screenToWorld({ x: 0, y: 0 }, viewport),
    width: surfaceSize.width / viewport.zoom,
    height: surfaceSize.height / viewport.zoom,
  }
}
