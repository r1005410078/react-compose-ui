import {
  getComposeFrameGuides,
  isComposeFrameEntity,
  listComposeFrameIds,
  resolveOwningFrameId,
  type ComposeDocument,
} from '@compose-ui/core'
import type { StageGuide, StagePoint } from './stage-geometry'

/**
 * 求编辑器动作应当作用的目标 Frame。
 *
 * @remarks
 * 规则与「多画板下的 Frame 动作目标」一致：当前选中的 Frame 优先；选中的不是 Frame 时解析
 * 为最近的祖先 Frame；没有选择时才回退到宿主给出的激活 Frame，最后回退到第一个根 Frame。
 *
 * 注意它解析的是**选区所属**的 Frame，与页面的「激活场景」不是一回事：激活场景只在没有
 * 选择时作为回退，MUST NOT 覆盖显式选择。两者同名会被传错，因此这里叫 target 而不是 active。
 *
 * @public
 */
export function resolveTargetFrameId(
  document: ComposeDocument,
  selectedIds: readonly string[],
  activeFrameId?: string | null,
): string | null {
  for (const entityId of selectedIds) {
    const frameId = resolveOwningFrameId(document, entityId)
    if (frameId) return frameId
  }
  if (activeFrameId && isComposeFrameEntity(document.entities[activeFrameId])) {
    return activeFrameId
  }
  return document.rootIds.find((id) => isComposeFrameEntity(document.entities[id]))
    ?? listComposeFrameIds(document)[0]
    ?? null
}

/** 世界坐标到 Frame 局部坐标的偏移求解端口。 */
export interface FrameOriginResolver {
  /** 返回该 Frame 局部原点的世界坐标；Frame 不存在时返回 null。 */
  getFrameOrigin(frameId: string): StagePoint | null
}

/**
 * 把一个 Frame 的局部辅助线映射到世界坐标。
 *
 * @remarks
 * v7 的辅助线保存在 Frame 局部坐标里，而 Stage 的吸附、命中与渲染全部在世界坐标中进行，
 * 因此读写两侧都要过一次这个映射——写回时用 {@link toFrameGuidePosition} 反向换算。
 *
 * @public
 */
export function listFrameWorldGuides(
  document: ComposeDocument,
  frameId: string | null,
  resolver: FrameOriginResolver,
): readonly (StageGuide & { readonly id: string })[] {
  if (!frameId) return []
  const origin = resolver.getFrameOrigin(frameId)
  if (!origin) return []
  return getComposeFrameGuides(document.entities[frameId]).map((guide) => ({
    id: guide.id,
    axis: guide.axis,
    value: guide.position + (guide.axis === 'x' ? origin.x : origin.y),
    source: 'guide' as const,
  }))
}

/** 把世界坐标下的辅助线位置换算回 Frame 局部坐标。 @public */
export function toFrameGuidePosition(
  axis: 'x' | 'y',
  worldPosition: number,
  origin: StagePoint,
): number {
  return worldPosition - (axis === 'x' ? origin.x : origin.y)
}
