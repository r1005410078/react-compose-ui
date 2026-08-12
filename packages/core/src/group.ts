import type { ComposeEntity, ComposeSize } from './document-types'
import { getComposeAppearance, getComposeClip, getComposeComposition, getComposeHierarchy } from './entity'

/** First-class Group 使用的稳定 Preset ID。 @public */
export const COMPOSE_GROUP_PRESET_ID = 'group' as const

/** 旧 Group 命令曾写入的基础 Component 顺序。 @internal */
const LEGACY_GROUP_BASE_COMPONENT_KEYS = [
  'Transform',
  'LayoutItem',
  'Visibility',
  'Lock',
  'Hierarchy',
  'Clip',
  'Appearance',
] as const

const GROUP_BASE_COMPONENT_KEYS = [
  'Transform',
  'LayoutItem',
  'GeometryConstraints',
  'Visibility',
  'Lock',
  'Hierarchy',
] as const

/** 创建 first-class Group Entity 的输入。 @public */
export interface CreateComposeGroupEntitySeedInput {
  /** 文档内稳定且唯一的 ID。 */
  readonly id: string
  /** 用户可见名称。 @defaultValue `"Group"` */
  readonly name?: string
  /** Group 的直接子项。 @defaultValue `[]` */
  readonly childIds?: readonly string[]
  /** 父级局部坐标。 @defaultValue `{ x: 0, y: 0 }` */
  readonly position?: { readonly x: number; readonly y: number }
  /** 持久化 fallback frame。 @defaultValue `{ width: 1, height: 1 }` */
  readonly size?: ComposeSize
  /** 为在旋转父级下保持世界几何而写入的局部旋转。 @defaultValue `0` */
  readonly rotation?: number
}

/**
 * 创建无外观、无裁剪、无布局行为的 first-class Group Entity。
 *
 * @remarks
 * Group 的持久化 frame 是稳定坐标系；Stage 可以从可见后代派生动态编辑范围，但不得因此改写它。
 *
 * @public
 */
export function createComposeGroupEntitySeed(
  input: CreateComposeGroupEntitySeedInput,
): ComposeEntity {
  const position = input.position ?? { x: 0, y: 0 }
  const size = input.size ?? { width: 1, height: 1 }
  return {
    id: input.id,
    name: input.name ?? 'Group',
    components: {
      Composition: {
        presetId: COMPOSE_GROUP_PRESET_ID,
        baseComponentKeys: [...GROUP_BASE_COMPONENT_KEYS],
        capabilityIds: [],
      },
      Transform: { rotation: input.rotation ?? 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: position.x, y: position.y },
        width: { mode: 'fixed', value: Math.max(1, size.width), min: 1, max: null },
        height: { mode: 'fixed', value: Math.max(1, size.height), min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      GeometryConstraints: { movable: true, resize: 'none', rotatable: false },
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: [...(input.childIds ?? [])] },
    },
  }
}

/** 判断 Entity 是否为新的 first-class Group。 @public */
export function isComposeGroupEntity(entity: ComposeEntity): boolean {
  return getComposeComposition(entity).presetId === COMPOSE_GROUP_PRESET_ID
    && getComposeHierarchy(entity) !== undefined
}

function sameKeys(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && expected.every((key) => actual.includes(key))
}

/**
 * 判断 Entity 是否精确匹配 main 历史版本的透明 Group seed。
 *
 * @remarks
 * 该兼容检测只允许解除旧分组，不会自动改写或把普通 `container` Preset 当作 Group。
 *
 * @public
 */
export function isLegacyComposeGroupEntity(entity: ComposeEntity): boolean {
  const composition = getComposeComposition(entity)
  const hierarchy = getComposeHierarchy(entity)
  if (
    composition.presetId !== null
    || !hierarchy
    || composition.capabilityIds.length !== 0
    || !sameKeys(composition.baseComponentKeys, LEGACY_GROUP_BASE_COMPONENT_KEYS)
    || !sameKeys(Object.keys(entity.components), ['Composition', ...LEGACY_GROUP_BASE_COMPONENT_KEYS])
  ) return false
  const clip = getComposeClip(entity)
  const appearance = getComposeAppearance(entity)
  if (!appearance) return false
  const backgroundPaint = appearance?.backgroundPaint
  return clip?.enabled === false
    && backgroundPaint?.kind === 'solid'
    && backgroundPaint.color === 'transparent'
    && appearance.borderColor === 'transparent'
    && appearance.borderWidth === 0
    && appearance.opacity === 1
    && appearance.shadow === null
}

/** 判断 Entity 是否可以通过兼容 Ungroup 命令解除结构包装。 @public */
export function isComposeUngroupableEntity(entity: ComposeEntity): boolean {
  return isComposeGroupEntity(entity) || isLegacyComposeGroupEntity(entity)
}
