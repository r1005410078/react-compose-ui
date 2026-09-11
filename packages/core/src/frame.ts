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
import { DEFAULT_COMPOSE_BACKGROUND_PAINT } from './paint'
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
 * 「多近算在这个东西上」的屏幕像素半径。
 *
 * @remarks
 * 住在 core 与 {@link COMPOSE_CURVE_PICK_TOLERANCE} 是同一条理由：它的消费者是画布的取点
 * 捕捉（`stage`）与预览的屏幕尺寸吸附（`preview`），而这两个包之间没有依赖关系——各写一份
 * 的症状是「同一个手势在两处的手感对不上」，而这种偏差没有人会主动去比。
 *
 * 单位是**屏幕像素**：容差必须在屏幕空间判定，同一个世界／尺寸差在 25% 与 100% 缩放下是
 * 完全不同的手感。
 *
 * @public
 */
export const COMPOSE_SNAP_RADIUS = 12

/** 常见宽高比的通名表：`[宽, 高, 通名]`，宽高已是最简。 */
const COMMON_ASPECT_RATIOS: readonly (readonly [number, number, string])[] = Object.freeze([
  [16, 9, '16:9'],
  [8, 5, '16:10'],
  [4, 3, '4:3'],
  [3, 2, '3:2'],
  [7, 3, '21:9'],
  [32, 9, '32:9'],
  [1, 1, '1:1'],
  [9, 16, '9:16'],
  [5, 8, '10:16'],
  [3, 4, '3:4'],
  [2, 3, '2:3'],
  [3, 7, '9:21'],
] satisfies readonly (readonly [number, number, string])[])

/** 落在通名表外时，最简分数还愿意写成 `a:b` 的分母上限；超过就退回小数。 */
const ASPECT_RATIO_MAX_DENOMINATOR = 20

/** 与通名表比对时的相对容差：落在这之内写 `~通名`，否则不写通名。 */
const ASPECT_RATIO_TOLERANCE = 0.02

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y > 0) {
    const next = x % y
    x = y
    y = next
  }
  return x
}

/**
 * 把尺寸格式化成宽高比标签，形如 `16:9`、`~16:9`、`2:3`、`2.13:1`。
 *
 * @remarks
 * **精确命中的判据是最简分数相等，不是比值接近。** 1920 × 1080 约掉就是 16:9，而
 * 1366 × 768 约掉是 683:384——它只是「接近 16:9」，写成精确的 `16:9` 会让用户以为换到
 * 1920 × 1080 不会改变形状。落在容差内的写 `~`，两者必须分得开。
 *
 * 宽高比是**算出来的显示信息**，不进协议、不存文档：它完全由尺寸决定，存第二份只会漂移。
 *
 * @returns 宽高比标签；高度不是正有限数时返回空串——没有答案时不编一个。
 * @public
 */
export function formatComposeAspectRatio(size: ComposeSize): string {
  const { width, height } = size
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return ''
  const ratio = width / height
  if (Number.isInteger(width) && Number.isInteger(height)) {
    const divisor = greatestCommonDivisor(width, height)
    const reducedWidth = width / divisor
    const reducedHeight = height / divisor
    const exact = COMMON_ASPECT_RATIOS.find(
      ([candidateWidth, candidateHeight]) =>
        candidateWidth === reducedWidth && candidateHeight === reducedHeight,
    )
    if (exact) return exact[2]
    const nearest = nearestCommonAspectRatio(ratio)
    if (nearest) return `~${nearest}`
    if (reducedHeight <= ASPECT_RATIO_MAX_DENOMINATOR) return `${reducedWidth}:${reducedHeight}`
    return `${formatComposeNumber(Math.round(ratio * 100) / 100)}:1`
  }
  const nearest = nearestCommonAspectRatio(ratio)
  if (nearest) return `~${nearest}`
  return `${formatComposeNumber(Math.round(ratio * 100) / 100)}:1`
}

/** 在通名表里找相对误差最小且落在容差内的一项。 */
function nearestCommonAspectRatio(ratio: number): string | null {
  let best: { readonly label: string; readonly error: number } | null = null
  COMMON_ASPECT_RATIOS.forEach(([candidateWidth, candidateHeight, label]) => {
    const candidate = candidateWidth / candidateHeight
    const error = Math.abs(ratio - candidate) / candidate
    if (error > ASPECT_RATIO_TOLERANCE) return
    if (!best || error < best.error) best = { label, error }
  })
  return best ? (best as { readonly label: string }).label : null
}

/**
 * 屏幕尺寸吸附的一个候选。
 *
 * @remarks
 * `target` 是预览目标自身的尺寸（也就是「回到 1:1」），`preset` 来自
 * {@link COMPOSE_SCENE_SIZE_PRESETS}。`preset` 字段在两种 kind 下都可能非空——目标尺寸
 * 恰好等于某个常见分辨率时它同样查得到通名，读数因此能写出「Full HD」。
 *
 * @public
 */
export interface ComposeScreenSizeSnapCandidate {
  readonly kind: 'target' | 'preset'
  readonly size: ComposeSize
  readonly preset: ComposeSceneSizePreset | null
}

/** {@link snapComposeScreenSize} 的选项。 @public */
export interface ComposeScreenSizeSnapOptions {
  /** 预览目标自身的尺寸；它是优先级最高的候选。 */
  readonly targetSize: ComposeSize
  /** 当前视图缩放；容差是屏幕距离，因此尺寸差要乘以它才能比较。 */
  readonly zoom: number
  /** 容差，屏幕像素。 @defaultValue {@link COMPOSE_SNAP_RADIUS} */
  readonly tolerance?: number
  /** 候选预设。 @defaultValue {@link COMPOSE_SCENE_SIZE_PRESETS} */
  readonly presets?: readonly ComposeSceneSizePreset[]
}

/** {@link snapComposeScreenSize} 的结果。 @public */
export interface ComposeScreenSizeSnapResult {
  /** 吸附之后的尺寸；未命中时是取整、钳过下限的输入值。 */
  readonly size: ComposeSize
  /** 命中的候选；未命中为 `null`，呈现层据此决定要不要画命中态。 */
  readonly snapped: ComposeScreenSizeSnapCandidate | null
}

/** 屏幕尺寸的下限：拖到零或负数没有意义，也会让下游的比例计算除零。 */
const MIN_SCREEN_SIZE = 1

/**
 * 把拖动出来的屏幕尺寸吸附到候选尺寸上。
 *
 * @remarks
 * 三条规则，各自都有一条它在挡的错误：
 *
 * 1. **优先级严格先于距离**：目标自身尺寸压过清单里的任何预设，即使某个预设更近。
 *    「拖回原尺寸」是最常落的那一次，不该被一档碰巧更近的分辨率抢走。
 * 2. **容差按屏幕距离判定**（尺寸差 × `zoom`），不是直接比较分辨率差。同样 40px 的
 *    分辨率差在 25% 与 100% 视图下手感天差地别——与极轴用屏幕距离而不是角度差同源。
 * 3. **粒度是整份分辨率**：候选是尺寸空间里的一个二维点，按欧氏距离比较，而不是两条
 *    各自独立的轴。沿用 {@link findComposeSceneSizePreset} 已经判过的那条——宽命中而
 *    高不命中不算匹配。
 *
 * 命中时返回候选**原样的尺寸**而不是取整值：目标尺寸可以带小数（历史文档），吸附回它
 * 必须逐位相等，否则「拖回原尺寸」会停在一个差零点几像素的地方。
 *
 * @param size - 拖动得到的原始尺寸，单位是被预览那块屏的像素。
 * @public
 */
export function snapComposeScreenSize(
  size: ComposeSize,
  options: ComposeScreenSizeSnapOptions,
): ComposeScreenSizeSnapResult {
  const {
    targetSize,
    zoom,
    tolerance = COMPOSE_SNAP_RADIUS,
    presets = COMPOSE_SCENE_SIZE_PRESETS,
  } = options
  const free: ComposeSize = {
    width: Math.max(MIN_SCREEN_SIZE, Math.round(size.width)),
    height: Math.max(MIN_SCREEN_SIZE, Math.round(size.height)),
  }
  // zoom 非正时屏幕距离没有意义（视口还没量出来）：不吸附比吸到任意一个候选上诚实。
  if (!Number.isFinite(zoom) || zoom <= 0) return { size: free, snapped: null }

  const screenDistance = (candidate: ComposeSize): number =>
    Math.hypot((size.width - candidate.width) * zoom, (size.height - candidate.height) * zoom)

  const target: ComposeScreenSizeSnapCandidate = {
    kind: 'target',
    size: targetSize,
    preset: findComposeSceneSizePreset(targetSize),
  }
  if (screenDistance(targetSize) <= tolerance) return { size: targetSize, snapped: target }

  // 与目标同尺寸的预设要去掉：它在上一步已经作为更高优先级的候选判过，留着只会让
  // 同一个落点有两个含义不同的命中结果。
  let best: { readonly candidate: ComposeScreenSizeSnapCandidate; readonly distance: number } | null = null
  presets.forEach((preset) => {
    if (preset.size.width === targetSize.width && preset.size.height === targetSize.height) return
    const distance = screenDistance(preset.size)
    if (distance > tolerance) return
    if (!best || distance < best.distance) {
      best = { candidate: { kind: 'preset', size: preset.size, preset }, distance }
    }
  })
  if (!best) return { size: free, snapped: null }
  const hit = (best as { readonly candidate: ComposeScreenSizeSnapCandidate }).candidate
  return { size: hit.size, snapped: hit }
}

/**
 * 新建场景使用的默认外观。
 *
 * @remarks
 * **背景透明，编辑器不替用户填色。** 场景背景是会被发布出去的真实像素而不是编辑器配色，
 * 先填一个颜色等于替用户做了一个他迟早要改的决定。这条曾经反过来写着"背景 MUST 与
 * Container Preset 默认外观相同"，理由是"否则用户会看到画容器和画场景颜色不一样"——而那
 * 正是需要看出来的区别：两者同色时用户读不出手上这块到底是场景还是容器。
 *
 * **边框宽度为 0**：布局求解会把边框计入内容盒（`node.setBorder`），场景又是绝对坐标的
 * 原点，1px 边框会把每个直接子级整体推离网格 1px——按网格吸附拖动后，属性面板里的 X 会读成
 * 7、15、23 而不是 8、16、24。用户当然可以给某块场景手动加边框，那是显式选择。
 *
 * 因此**场景边界的可辨认性由 Stage 的编辑器边界描边承担，不由这里的任何字段承担**：默认值
 * 只保护第一次，用户把背景改成与工作区相同的颜色之后，边界必须仍然读得出来。
 *
 * 本常量的变化**不迁移既有文档**：默认值只作用于新建，已有场景保留自己写下的背景。
 *
 * @public
 */
export const COMPOSE_DEFAULT_SCENE_APPEARANCE: ComposeAppearance = Object.freeze({
  backgroundPaint: { ...DEFAULT_COMPOSE_BACKGROUND_PAINT },
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
