import {
  COMPOSE_COMPONENT_NEST_DEPTH_LIMIT,
  getComposeFrame,
  getComposeLayoutItem,
  migrateLegacyComposeInstanceOverrides,
  parseComposeInstanceOverrides,
  resolveComposeInstanceOverrides,
  validateComposeDocument,
  type ComposeComponentInstanceOverrides,
  type ComposeComponentReference,
  type ComposeDocument,
  type ComposeResolvedComponentSnapshot,
} from '@compose-ui/core'
import { sampleComponentInstanceDocument } from './animation'
import {
  componentInstanceContentScale,
  readComponentInstanceContentFit,
  type ComponentInstanceContentFit,
} from './content-fit'
import { componentInstanceFlipScale, readComponentInstanceFlip } from './flip'

/**
 * 组件实例准备失败的原因。
 *
 * @public
 */
export type ComposeComponentInstancePrepareFailure =
  | 'invalid-snapshot'
  | 'invalid-overrides'
  | 'cycle'
  | 'too-deep'

/**
 * 组件实例准备的结果：可直接求解的嵌套文档，或可判别的失败原因。
 *
 * @public
 */
export type ComposePreparedComponentInstance =
  | {
      readonly ok: true
      /** 组件引用键（`providerId:scope:assetKey`），嵌套时追加到祖先链。 */
      readonly key: string
      /** 已覆盖、已采样、根锚到原点（`layout` 时根尺寸已对齐实例盒）的嵌套文档。 */
      readonly document: ComposeDocument
      readonly contentFit: ComponentInstanceContentFit
      /** 组件根的自然尺寸；`scale` 时内容按它摆放。 */
      readonly rootSize: { readonly width: number; readonly height: number } | null
      /** `scale` 时的两轴比值；`layout` 或盒未知时为 1。 */
      readonly contentScale: { readonly x: number; readonly y: number }
      /** 翻转对应的两轴 ±1，绕实例盒中心作用。 */
      readonly flipScale: { readonly x: number; readonly y: number }
    }
  | { readonly ok: false; readonly reason: ComposeComponentInstancePrepareFailure }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readReference(value: unknown): ComposeComponentReference | null {
  if (!isRecord(value)) return null
  return value.kind === 'component'
    && typeof value.providerId === 'string'
    && typeof value.assetKey === 'string'
    && (value.scope === 'persistent' || value.scope === 'session')
    ? value as ComposeComponentReference
    : null
}

function readSnapshot(value: unknown): ComposeResolvedComponentSnapshot | null {
  if (!isRecord(value) || !isRecord(value.document)) return null
  const validation = validateComposeDocument(value.document)
  if (!validation.valid) return null
  // 组件根允许是任意 Entity；只有「单根」是硬约束。
  if (
    validation.document.rootIds.length !== 1
    || !validation.document.rootIds[0]
    || typeof value.componentId !== 'string'
    || (value.kind !== 'base' && value.kind !== 'variant')
    || typeof value.revision !== 'string'
    || !Array.isArray(value.appliedLineage)
  ) return null
  return {
    componentId: value.componentId,
    kind: value.kind,
    revision: value.revision,
    document: validation.document,
    appliedLineage: value.appliedLineage as ComposeResolvedComponentSnapshot['appliedLineage'],
  }
}

/**
 * 读取实例覆盖，兼容尚未落盘为分区形状的历史实体。
 *
 * @remarks
 * 缺少 `instanceOverrides` 时对旧 `propertyOverrides` 走显式迁移；仍带 `properties` 分区的历史
 * 数据同样迁移，但属性覆盖需要已删除的 Base 定义才能还原目标，只能保留结构分区。
 */
function readInstanceOverrides(
  props: Readonly<Record<string, unknown>>,
): ComposeComponentInstanceOverrides | null {
  const raw = props.instanceOverrides
  if (raw === undefined) {
    const legacy = props.propertyOverrides
    if (!isRecord(legacy)) return null
    return migrateLegacyComposeInstanceOverrides(legacy)
  }
  const parsed = parseComposeInstanceOverrides(raw)
  if (parsed.ok) return parsed.overrides
  return isRecord(raw) && 'properties' in raw ? migrateLegacyComposeInstanceOverrides(raw) : null
}

/**
 * 嵌套 Layout Runtime 的画布尺寸取自根 Frame。实例 Resize 把组件根写成 fixed，但
 * Frame.size 仍可能是创建时的旧值；对单根组件文档，把根 Frame 的尺寸与根 fixed
 * LayoutItem 对齐，Auto Layout 的 fill 子项才能随外框重排。
 *
 * @remarks
 * Frame.size 是尺寸的唯一事实来源；实例覆盖改写的是根的 LayoutItem，因此这里把两者对齐，
 * 而不是维护第二份尺寸。
 */
function alignComponentDocumentOutput(document: ComposeDocument): ComposeDocument {
  const rootId = document.rootIds[0]
  if (!rootId || document.rootIds.length !== 1) return document
  const root = document.entities[rootId]
  const frame = getComposeFrame(root)
  if (!root || !frame) return document
  const item = getComposeLayoutItem(root)
  const width = item.width.mode === 'fixed' ? item.width.value : frame.size.width
  const height = item.height.mode === 'fixed' ? item.height.value : frame.size.height
  if (width === frame.size.width && height === frame.size.height) return document
  return {
    ...document,
    entities: {
      ...document.entities,
      [rootId]: {
        ...root,
        components: {
          ...root.components,
          Frame: { ...frame, size: { width, height } },
        },
      },
    },
  }
}

/**
 * 把组件根锚到原点。
 *
 * @remarks
 * 根的 `LayoutItem.offset` 是「场景摆在组件文档工作区的哪里」——那是宿主编辑视图的摆位，
 * 不是内容；Frame 的「坐标原点」隔离边界意味着实例必须从 (0,0) 取景。不锚的话，在组件
 * 文档里挪过一次场景，保存后所有实例的内容整体平移一段并被盒裁掉——组件文档里明明画着，
 * 页面上的实例却是空的，而屏幕上没有任何东西解释为什么。
 */
function anchorComponentDocumentRoot(document: ComposeDocument): ComposeDocument {
  const rootId = document.rootIds[0]
  if (!rootId || document.rootIds.length !== 1) return document
  const root = document.entities[rootId]
  if (!root) return document
  const item = getComposeLayoutItem(root)
  if (!item || (item.offset.x === 0 && item.offset.y === 0)) return document
  return {
    ...document,
    entities: {
      ...document.entities,
      [rootId]: {
        ...root,
        components: {
          ...root.components,
          LayoutItem: { ...item, offset: { x: 0, y: 0 } },
        },
      },
    },
  }
}

/**
 * 把一个组件实例的 Renderer props 准备成可直接求解的嵌套文档。
 *
 * @remarks
 * 预览的实例渲染器与 QML 导出共用这一份管线——各写一份的症状是「预览里对、导出的不对」，
 * 而两边都没有报错。顺序是**快照 → 实例覆盖 → 动画采样 → 根锚到原点 → 按盒对齐根尺寸**：
 * 覆盖表达作者意图，采样表达此刻的呈现，反过来会让同一份覆盖在不同时刻算出不同结果；
 * 对齐读的是根的 Frame 尺寸与 LayoutItem，两者都可能被轨道改写，因此排在采样之后。
 *
 * `'scale'` 不对齐根尺寸：嵌套文档按自然尺寸求解、由外层按比值缩放，两支不得同时改一份
 * 尺寸数据。
 *
 * 祖先链是显式参数而不是 React Context：渲染器从 Context 读出来传进来，导出侧由递归自然
 * 得到。深度缺省取祖先链长度；渲染器传入 Context 里的深度（两者由同一个 Provider 一起推进）。
 *
 * @param input.props - 实例 Entity 的 Renderer props。
 * @param input.hostBox - 实例盒尺寸；只有 `'scale'` 求比值用，未知时比值回退 1。
 * @param input.ancestorKeys - 外层各实例的组件引用键，用于检查循环引用。
 * @param input.depth - 当前嵌套深度，缺省为祖先链长度。
 *
 * @public
 */
export function prepareComposeComponentInstance(input: {
  readonly props: Readonly<Record<string, unknown>>
  readonly hostBox: { readonly width: number; readonly height: number } | null
  readonly ancestorKeys: readonly string[]
  readonly depth?: number
}): ComposePreparedComponentInstance {
  const { props } = input
  const reference = readReference(props.reference)
  const snapshot = readSnapshot(props.resolvedSnapshot)
  const overrides = readInstanceOverrides(props)
  if (!reference || !snapshot || !overrides) return { ok: false, reason: 'invalid-snapshot' }
  const key = `${reference.providerId}:${reference.scope}:${reference.assetKey}`
  if (input.ancestorKeys.includes(key)) return { ok: false, reason: 'cycle' }
  if ((input.depth ?? input.ancestorKeys.length) >= COMPOSE_COMPONENT_NEST_DEPTH_LIMIT) {
    return { ok: false, reason: 'too-deep' }
  }
  const resolved = resolveComposeInstanceOverrides({ document: snapshot.document, overrides })
  if (!resolved.ok) return { ok: false, reason: 'invalid-overrides' }
  const contentFit = readComponentInstanceContentFit(props)
  const anchored = anchorComponentDocumentRoot(
    sampleComponentInstanceDocument(resolved.document, props.animation, props.animationTime),
  )
  const document = contentFit === 'scale' ? anchored : alignComponentDocumentOutput(anchored)
  const rootId = document.rootIds[0]
  const rootSize = (rootId ? getComposeFrame(document.entities[rootId]) : null)?.size ?? null
  return {
    ok: true,
    key,
    document,
    contentFit,
    rootSize,
    contentScale: contentFit === 'scale'
      ? componentInstanceContentScale(input.hostBox, rootSize)
      : { x: 1, y: 1 },
    flipScale: componentInstanceFlipScale(readComponentInstanceFlip(props)),
  }
}
