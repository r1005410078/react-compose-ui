import {
  getComposeFrame,
  getComposeHierarchy,
  getComposeLayoutItem,
  isComposeGroupEntity,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeSize,
} from '@compose-ui/core'
import type { StagePoint, StageRect } from '../geometry'

/**
 * 判断一个 Entity 是否是"容器类"——即能作为场景的那种容器。
 *
 * @remarks
 * 场景就是放在顶层的容器，所以"在场景外新建它会得到一块场景吗"这个问题等价于"它是容器吗"。
 * Group 有 `Hierarchy` 但被排除：它是结构包装而不是框住一片区域的容器，没有自己的尺寸语义，
 * 升格成场景后 `Frame.size` 会与它 `resize: 'none'` 的几何约束互相矛盾。
 *
 * @public
 */
export function isComposeContainerEntity(entity: ComposeEntity): boolean {
  return getComposeHierarchy(entity) !== undefined && !isComposeGroupEntity(entity)
}

/**
 * 把一个包围盒钳制进给定的 Frame 尺寸。
 *
 * @remarks
 * 用于"在所有场景之外新建非容器"这条路径：落点在定义上一定落在目标场景外面，直接换算得到的
 * 局部坐标必然越界——场景开了 Clip 时新对象直接消失，没开时飘在场景外，两种都读作"画了但
 * 没出现"。钳制只平移左上角、不改宽高，因此用户画多大就是多大。
 *
 * Entity 在某一轴上大于 Frame 时该轴钳到 0：此时无论如何都装不下，靠齐原点至少让它可见且
 * 可继续拖动，比钳出一个负坐标更好理解。
 *
 * @param bounds - 目标 Frame 局部坐标系下的包围盒。
 * @param frameSize - 目标 Frame 的尺寸。
 * @returns 宽高不变、左上角落在 Frame 内的新包围盒。
 * @public
 */
export function clampBoundsIntoFrame(bounds: StageRect, frameSize: ComposeSize): StageRect {
  return {
    x: Math.min(Math.max(bounds.x, 0), Math.max(frameSize.width - bounds.width, 0)),
    y: Math.min(Math.max(bounds.y, 0), Math.max(frameSize.height - bounds.height, 0)),
    width: bounds.width,
    height: bounds.height,
  }
}

/** 新场景与既有场景之间的水平间隙。 */
const SCENE_GAP = 80

/**
 * 求下一块场景的摆放位置。
 *
 * @remarks
 * 摆在既有场景最右侧再留一段间隙，避免与任何一块重叠。所有"凭空新建一块场景"的入口都必须
 * 走这里，否则命令面板与场景树各算一套，用户会得到两种不同的排布。
 *
 * @public
 */
export function resolveNextScenePlacement(document: ComposeDocument): StagePoint {
  const right = document.rootIds.reduce((max, id) => {
    const entity = document.entities[id]
    const frame = getComposeFrame(entity)
    if (!entity || !frame) return max
    return Math.max(max, getComposeLayoutItem(entity).offset.x + frame.size.width)
  }, 0)
  return { x: right + SCENE_GAP, y: 0 }
}
