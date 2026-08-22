import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeAnimation,
  type ComposeAppearance,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeFrame,
  type ComposeFrameGuide,
  type ComposeSize,
  type JsonObject,
} from './document-types'
import { formatComposeNumber } from './geometry-precision'
import type { ComposePaint } from './paint'

/** 新建 Frame 时使用的默认尺寸。 @public */
export const COMPOSE_DEFAULT_FRAME_SIZE: ComposeSize = { width: 1280, height: 720 }

/**
 * 场景常见尺寸预设的单项。
 *
 * @public
 */
export interface ComposeSceneSizePreset {
  /** 稳定标识，形如 `1920x1080`；用于下拉与单选的 value，不面向用户显示。 */
  readonly id: string
  /** 该分辨率的公认通名；没有通名时为空串。 */
  readonly name: string
  readonly size: ComposeSize
}

/**
 * 场景常见尺寸预设。
 *
 * @remarks
 * 编辑器有两个改场景尺寸的入口——画布标签上的尺寸胶囊与 Inspector 的场景分组——它们必须
 * 列出同一组分辨率，因此预设住在 core 而不是任一 UI 包里：`stage` 与 `materials` 之间没有
 * 依赖关系，各写一份必然漂移。
 *
 * 预设只是快捷入口，不参与文档校验：任何正有限尺寸都是合法的 `Frame.size`。
 *
 * @public
 */
export const COMPOSE_SCENE_SIZE_PRESETS: readonly ComposeSceneSizePreset[] = Object.freeze([
  { id: '1280x720', name: 'HD', size: { width: 1280, height: 720 } },
  { id: '1366x768', name: '', size: { width: 1366, height: 768 } },
  { id: '1440x900', name: '', size: { width: 1440, height: 900 } },
  { id: '1920x1080', name: 'Full HD', size: { width: 1920, height: 1080 } },
  { id: '2560x1440', name: 'QHD', size: { width: 2560, height: 1440 } },
  { id: '3840x2160', name: '4K UHD', size: { width: 3840, height: 2160 } },
] satisfies readonly ComposeSceneSizePreset[])

/**
 * 按尺寸反查常见尺寸预设。
 *
 * @param size - 待匹配的尺寸。
 * @returns 宽高都完全相等的预设；没有匹配时返回 `null`（即"自定义尺寸"）。
 * @public
 */
export function findComposeSceneSizePreset(size: ComposeSize): ComposeSceneSizePreset | null {
  return COMPOSE_SCENE_SIZE_PRESETS.find(
    (preset) => preset.size.width === size.width && preset.size.height === size.height,
  ) ?? null
}

/**
 * 把尺寸格式化成画布与弹框共用的 `1920 × 1080`。
 *
 * @remarks
 * 乘号用 U+00D7 而不是字母 x，且不带单位：宽高在所有 locale 下都是同一串数字，因此这里
 * 不经过 i18n。数值走统一的几何精度——历史数据里带小数的场景尺寸不该在标签上甩出一串长尾。
 * @public
 */
export function formatComposeSceneSize(size: ComposeSize): string {
  return `${formatComposeNumber(size.width)} × ${formatComposeNumber(size.height)}`
}

/**
 * 把预设格式化成带通名的选项文案，形如 `1920 × 1080 (Full HD)`。
 *
 * @public
 */
export function formatComposeSceneSizePresetLabel(preset: ComposeSceneSizePreset): string {
  const size = formatComposeSceneSize(preset.size)
  return preset.name ? `${size} (${preset.name})` : size
}

/**
 * 新建场景使用的默认外观。
 *
 * @remarks
 * 场景就是放在顶层的容器，背景 MUST 与 `@compose-ui/materials` 的 Container Preset 默认
 * 外观相同——否则用户会看到"画一个容器"和"画一块场景"颜色不一样。core 不能依赖 materials
 * （架构边界），所以这是一份刻意的副本，由 materials 侧的断言锁住：漂移会让单测立刻变红。
 *
 * **唯一的例外是边框宽度**：Container 默认带 1px 边框，场景默认不带。布局求解会把边框
 * 计入内容盒（`node.setBorder`），场景又是绝对坐标的原点，1px 边框会把每个直接子级整体推
 * 离网格 1px——按网格吸附拖动后，属性面板里的 X 会读成 7、15、23 而不是 8、16、24。
 * 用户当然可以给某块场景手动加边框，那是显式选择；默认值不该埋进这个偏差。
 *
 * @public
 */
export const COMPOSE_DEFAULT_SCENE_APPEARANCE: ComposeAppearance = Object.freeze({
  backgroundPaint: { kind: 'solid', color: '#1e2229' },
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
} satisfies ComposeAppearance)

/**
 * 创建一个 Frame Component。
 *
 * @param size - 缺省为 {@link COMPOSE_DEFAULT_FRAME_SIZE}。
 * @returns 每次调用返回可独立修改的新对象。
 * @public
 */
export function createComposeFrame(size: ComposeSize = COMPOSE_DEFAULT_FRAME_SIZE): ComposeFrame {
  return { size: { width: size.width, height: size.height }, guides: [] }
}

/**
 * 读取 Entity 的 Frame Component；不是 Frame 时返回 `null`。
 *
 * @public
 */
export function getComposeFrame(entity: ComposeEntity | undefined): ComposeFrame | null {
  const frame = entity?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.frame]
  return frame ? (frame as ComposeFrame) : null
}

/** 判断 Entity 是否为 Frame。 @public */
export function isComposeFrameEntity(entity: ComposeEntity | undefined): boolean {
  return getComposeFrame(entity) !== null
}

/**
 * 归一化读取 Frame 的局部辅助线。
 *
 * @remarks
 * `guides` 是可选字段，缺省表示"无辅助线"。所有调用方都必须走这里而不是各自写 `?? []`。
 *
 * @public
 */
export function getComposeFrameGuides(
  entity: ComposeEntity | undefined,
): readonly ComposeFrameGuide[] {
  return getComposeFrame(entity)?.guides ?? []
}

/**
 * 求 Entity 所属的最近祖先 Frame。
 *
 * @remarks
 * Frame 是坐标、布局、裁剪、动画与脚本作用域的共同边界，因此"这个 Entity 属于哪个作用域"
 * 是 animation、stage 与 editor 都要问的同一个问题——统一在 core 求解，避免三处各写一份
 * 会漂移的向上遍历。
 *
 * Entity 自身是 Frame 时返回它自己：一个 Frame 的动画清单挂在它自己身上。
 *
 * @returns 所属 Frame 的 Entity ID；Entity 不存在或不可达任何 Frame 时返回 `null`。
 * @public
 */
export function resolveOwningFrameId(
  document: ComposeDocument,
  entityId: string,
): string | null {
  if (!document.entities[entityId]) return null
  if (isComposeFrameEntity(document.entities[entityId])) return entityId
  const parentById = buildParentIndex(document)
  // 逐级上溯而不是递归，避免深层嵌套下的栈深度问题；文档拓扑保证无环，无需 visited 集合。
  let current = parentById.get(entityId)
  while (current !== undefined && current !== null) {
    if (isComposeFrameEntity(document.entities[current])) return current
    current = parentById.get(current) ?? null
  }
  return null
}

/**
 * 判断两个 Entity 之间是否跨越了嵌套 Frame 边界。
 *
 * @remarks
 * 供动画轨道校验使用：轨道所属 Entity 的最近 Frame 必须正是持有该动画清单的 Frame。
 *
 * @public
 */
export function isWithinFrame(
  document: ComposeDocument,
  entityId: string,
  frameId: string,
): boolean {
  return resolveOwningFrameId(document, entityId) === frameId
}

/** 列出文档中全部 Frame Entity ID，按文档顺序稳定返回。 @public */
export function listComposeFrameIds(document: ComposeDocument): readonly string[] {
  return Object.keys(document.entities).filter((id) =>
    isComposeFrameEntity(document.entities[id]))
}

function buildParentIndex(document: ComposeDocument): Map<string, string | null> {
  const parentById = new Map<string, string | null>()
  document.rootIds.forEach((id) => parentById.set(id, null))
  Object.entries(document.entities).forEach(([parentId, entity]) => {
    const hierarchy = entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy]
    if (!hierarchy || !Array.isArray(hierarchy.childIds)) return
    hierarchy.childIds.forEach((childId) => {
      if (typeof childId === 'string') parentById.set(childId, parentId)
    })
  })
  return parentById
}

/**
 * 创建一个完整的 Frame Entity。
 *
 * @remarks
 * Frame 是 v7 唯一的"有尺寸的结构单元"，页面根、画板、组件根都用它，因此构造逻辑必须只有
 * 一份：宿主、迁移器与测试夹具共用这里，避免各自拼装出形状略有出入的 Frame。
 *
 * `LayoutItem` 的 fixed fallback 与 `Frame.size` 保持一致——Frame 一旦被降格为普通容器，
 * 尺寸不应当跳回一个陌生的值。
 *
 * @public
 */
export function createComposeFrameEntity(options: {
  readonly id: string
  readonly name?: string
  readonly childIds?: readonly string[]
  readonly size?: ComposeSize
  readonly offset?: { readonly x: number; readonly y: number }
  readonly backgroundPaint?: ComposePaint
  /**
   * 覆盖整份外观。缺省为 {@link COMPOSE_DEFAULT_SCENE_APPEARANCE}；组件根、动画文件默认根
   * 与测量探针这类非场景用途必须显式传入透明外观。
   */
  readonly appearance?: ComposeAppearance
  readonly animations?: readonly ComposeAnimation[]
}): ComposeEntity {
  const frame = createComposeFrame(options.size)
  const offset = options.offset ?? { x: 0, y: 0 }
  const base: Record<string, JsonObject> = {
    Transform: { rotation: 0 },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: offset.x, y: offset.y },
      width: { mode: 'fixed', value: frame.size.width, min: 1, max: null },
      height: { mode: 'fixed', value: frame.size.height, min: 1, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Hierarchy: { childIds: [...(options.childIds ?? [])] },
    Frame: frame,
    // 场景默认与容器同色；backgroundPaint 只覆盖背景一项，appearance 覆盖整份。
    Appearance: {
      ...(options.appearance ?? COMPOSE_DEFAULT_SCENE_APPEARANCE),
      ...(options.backgroundPaint ? { backgroundPaint: options.backgroundPaint } : {}),
    },
    ...(options.animations ? { Animations: { items: options.animations } as JsonObject } : {}),
  }
  return {
    id: options.id,
    name: options.name ?? options.id,
    components: {
      Composition: {
        presetId: 'frame',
        baseComponentKeys: Object.keys(base),
        capabilityIds: [],
      },
      ...base,
    },
  }
}

/**
 * 把一个既有 Entity 就地升格为 Frame。
 *
 * @remarks
 * 升格**只做一件事**：加上 `Frame`。id、名称、子级与其余全部 Component——包括 `Appearance`
 * 与 `Clip`——原地保留，不做任何规范化。这是"场景就是放在顶层的容器"这句话的实现：用户画
 * 一个改过底色的容器再把它变成场景，颜色不应该被悄悄改掉。归一化只发生在
 * {@link createComposeFrameEntity} 构造**新**场景时。
 *
 * `Frame` 会被写进 `Composition.baseComponentKeys`，此后 `entity.component.remove` 会拒绝
 * 移除它——否则 Inspector 上会出现一个能把根场景变成非法文档的删除按钮。`Hierarchy` 只在
 * 本次补齐时才写进该列表：升格不该顺手保护一个它没有创建的 Component。
 *
 * 对已经是 Frame 的 Entity 调用是幂等的，只更新 `size`。
 *
 * @param entity - 待升格的 Entity。
 * @param size - 升格后的 Frame 尺寸。
 * @returns 新的 Entity 对象；入参不被修改。
 * @public
 */
export function promoteComposeEntityToFrame(
  entity: ComposeEntity,
  size: ComposeSize,
): ComposeEntity {
  const { composition: compositionKey, frame: frameKey, hierarchy: hierarchyKey }
    = COMPOSE_BUILTIN_COMPONENT_KEYS
  const needsHierarchy = entity.components[hierarchyKey] === undefined
  const composition = entity.components[compositionKey] as
    { readonly baseComponentKeys?: readonly string[] } | undefined
  const baseComponentKeys = composition?.baseComponentKeys ?? []
  return {
    ...entity,
    components: {
      ...entity.components,
      ...(composition
        ? {
            [compositionKey]: {
              ...composition,
              baseComponentKeys: [
                ...baseComponentKeys,
                ...(needsHierarchy && !baseComponentKeys.includes(hierarchyKey)
                  ? [hierarchyKey]
                  : []),
                ...(baseComponentKeys.includes(frameKey) ? [] : [frameKey]),
              ],
            } as JsonObject,
          }
        : {}),
      // Frame 必须同时是容器：升格目标可能是一个还没有 Hierarchy 的叶 Entity。
      ...(needsHierarchy ? { [hierarchyKey]: { childIds: [] } } : {}),
      // 对已经是 Frame 的 Entity 重复调用只改尺寸，辅助线不能被重置。
      [frameKey]: { ...createComposeFrame(size), guides: getComposeFrameGuides(entity) },
    },
  }
}
