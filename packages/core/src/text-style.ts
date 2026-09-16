import { BUILTIN_COMMAND_TYPES } from './builtin-commands'
import type { EditorCommand } from './command-types'
import { COMPOSE_BUILTIN_COMPONENT_KEYS } from './document-types'
import type { ComposeDocument, ComposeEntity, JsonObject } from './document-types'

/**
 * 一条共享文字样式。
 *
 * @remarks
 * `props` 是一组排版属性值，键与 Text Renderer 的 props 同名——两边用同一套名字，「样式管
 * 哪几个字段」因此从样式本身读得出来，不需要第二张对照表。
 *
 * @public
 */
export interface ComposeTextStyle extends JsonObject {
  /** 用户可读名称。 */
  readonly name: string
  /** 这条样式给出的排版值；键与 Text Renderer 的 props 同名。 */
  readonly props: JsonObject
}

/**
 * 「这个 Entity 跟随哪条样式」。
 *
 * @remarks
 * 它是 **Entity 的能力而不是某个 Renderer 的字段**——与 `Interaction`、`Ports`、`Wire` 同一条
 * 判断；将来加别的样式种类时只在这里多一个槽位，Renderer 协议一个字节不改。
 *
 * @public
 */
export type ComposeStyleRef = JsonObject & {
  /** 跟随的文字样式 id；缺席即不跟随。 */
  readonly text?: string
}

/** 读取 Entity 的样式引用；缺席即不跟随任何样式。 @public */
export function getComposeStyleRef(
  entity: ComposeEntity | undefined,
): ComposeStyleRef | undefined {
  return entity?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.style] as ComposeStyleRef | undefined
}

/** 读取文档的文字样式表；缺席即没有样式。 @public */
export function getComposeTextStyles(
  document: ComposeDocument | undefined,
): Readonly<Record<string, ComposeTextStyle>> {
  return document?.styles ?? {}
}

/**
 * 一个 Entity 的样式解析状态。
 *
 * @remarks
 * 与导线绑定那三态逐字同源：「还没配」「配错了」「配的东西没了」必须可区分，而把悬空做成
 * 文档非法会让删掉一条样式就阻断保存。
 *
 * @public
 */
export type ComposeStyleRefState = 'none' | 'bound' | 'dangling'

/** 判定一个 Entity 的文字样式引用处于哪一档。 @public */
export function getComposeTextStyleState(
  document: ComposeDocument | undefined,
  entity: ComposeEntity | undefined,
): ComposeStyleRefState {
  const id = getComposeStyleRef(entity)?.text
  if (id === undefined) return 'none'
  return getComposeTextStyles(document)[id] ? 'bound' : 'dangling'
}

/**
 * 把文字样式解析进文档。
 *
 * @remarks
 * **样式的值垫底，作者写下的 props 覆盖**——因此跟随样式的字段在文档里**缺席**，而文档里
 * 出现那个字段就表示它被这一处覆盖了。推论写在命令那一侧：「应用样式」必须在同一个事务里
 * 删掉被管辖的那几个 props，否则样式加上去什么都不会变。
 *
 * 悬空引用**保留作者写下的值**并照常渲染：它只是解析失败，不是文档非法。
 *
 * 纯函数：不修改输入文档，同一份文档解析多少次都是同一个答案。没有任何 Entity 跟随样式时
 * **原样交回输入引用**——下游普遍按引用判断「文档变没变」，凭空造一份新的会让每一帧都像是
 * 改过了。
 *
 * @public
 */
export function resolveComposeStyles(document: ComposeDocument): ComposeDocument {
  const styles = getComposeTextStyles(document)
  if (Object.keys(styles).length === 0) return document
  let changed = false
  const entities: Record<string, ComposeEntity> = {}
  for (const [id, entity] of Object.entries(document.entities)) {
    const styleId = getComposeStyleRef(entity)?.text
    const style = styleId === undefined ? undefined : styles[styleId]
    const renderer = entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.renderer] as
      { readonly type: string; readonly props?: JsonObject } | undefined
    if (!style || !renderer) {
      entities[id] = entity
      continue
    }
    changed = true
    entities[id] = {
      ...entity,
      components: {
        ...entity.components,
        [COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]: {
          ...renderer,
          props: { ...style.props, ...(renderer.props ?? {}) },
        } as JsonObject,
      },
    }
  }
  return changed ? { ...document, entities } : document
}

/**
 * 「应用样式」的规划。
 *
 * @remarks
 * 关键的一半是**同时删掉这条样式管辖的那几个 props**：解析是「样式垫底、作者值覆盖」，
 * 不删的话每一个被管辖的字段都还是作者值，样式加上去**什么都不会变**——而屏幕上没有任何
 * 东西解释为什么。两件事必须在**一个事务**里，否则中间会出现一个可观察的不一致态，撤销
 * 也要按两下。
 *
 * 不造新命令词：`entity.component.update` 与 `entity.renderer.props.set` 已经能表达它，
 * 而「已有等价命令的动作不再造第二个词」是仓库的既有规矩。
 *
 * @param idFactory - 宿主提供的命令 id 工厂。
 * @returns 一条 batch 命令；目标没有 Renderer 时为 `null`。
 * @public
 */
export function planComposeApplyTextStyle(input: {
  readonly document: ComposeDocument
  readonly entityIds: readonly string[]
  readonly styleId: string
  readonly idFactory: () => string
}): EditorCommand | null {
  const style = getComposeTextStyles(input.document)[input.styleId]
  if (!style) return null
  const governed = Object.keys(style.props)
  const commands: EditorCommand[] = []
  for (const entityId of input.entityIds) {
    const entity = input.document.entities[entityId]
    const renderer = entity?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.renderer] as
      { readonly type: string; readonly props?: JsonObject } | undefined
    if (!entity || !renderer) continue
    const existing = getComposeStyleRef(entity)
    const next = Object.fromEntries(
      Object.entries(renderer.props ?? {}).filter(([key]) => !governed.includes(key)),
    )
    commands.push({
      id: input.idFactory(),
      type: BUILTIN_COMMAND_TYPES.setRendererProps,
      payload: { entityId, props: next },
    }, {
      id: input.idFactory(),
      /*
       * 按「Component 在不在」分流：`entity.component.update` 在缺席时被拒、
       * `entity.component.add` 在已存在时被拒，两者都不兜底。第一次应用样式走的必然是
       * add 这一支——不分流的症状是「点了没反应」，而整个 batch 会被一起拒掉。
       */
      type: existing === undefined
        ? BUILTIN_COMMAND_TYPES.addComponent
        : BUILTIN_COMMAND_TYPES.updateComponent,
      payload: {
        entityId,
        key: COMPOSE_BUILTIN_COMPONENT_KEYS.style,
        value: { ...existing, text: input.styleId },
      },
    })
  }
  if (commands.length === 0) return null
  return {
    id: input.idFactory(),
    type: BUILTIN_COMMAND_TYPES.batch,
    payload: { commands: commands as unknown as JsonObject[] },
    meta: {
      label: `Apply style ${style.name}`,
      source: 'style',
      targetIds: input.entityIds,
    },
  }
}

/**
 * 「脱离样式」的规划。
 *
 * @remarks
 * 把解析出来的值写成作者值、再删掉引用，因此**呈现逐像素不变**——脱离是一次「把跟随换成
 * 自己写下」，不是一次外观改动。同样在一个事务里。
 *
 * @returns 一条 batch 命令；没有任何目标在跟随样式时为 `null`。
 * @public
 */
export function planComposeDetachTextStyle(input: {
  readonly document: ComposeDocument
  readonly entityIds: readonly string[]
  readonly idFactory: () => string
}): EditorCommand | null {
  const resolved = resolveComposeStyles(input.document)
  const commands: EditorCommand[] = []
  for (const entityId of input.entityIds) {
    const entity = input.document.entities[entityId]
    if (!entity || getComposeStyleRef(entity)?.text === undefined) continue
    const renderer = resolved.entities[entityId]?.components[
      COMPOSE_BUILTIN_COMPONENT_KEYS.renderer
    ] as { readonly props?: JsonObject } | undefined
    commands.push({
      id: input.idFactory(),
      type: BUILTIN_COMMAND_TYPES.setRendererProps,
      payload: { entityId, props: { ...(renderer?.props ?? {}) } },
    }, {
      id: input.idFactory(),
      type: BUILTIN_COMMAND_TYPES.removeComponent,
      payload: { entityId, key: COMPOSE_BUILTIN_COMPONENT_KEYS.style },
    })
  }
  if (commands.length === 0) return null
  return {
    id: input.idFactory(),
    type: BUILTIN_COMMAND_TYPES.batch,
    payload: { commands: commands as unknown as JsonObject[] },
    meta: { label: 'Detach style', source: 'style', targetIds: input.entityIds },
  }
}
