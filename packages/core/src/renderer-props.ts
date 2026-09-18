import { BUILTIN_COMMAND_TYPES } from './builtin-commands'
import type { EditorCommand } from './command-types'
import { COMPOSE_BUILTIN_COMPONENT_KEYS } from './document-types'
import type { ComposeDocument, ComposeEntity, JsonObject } from './document-types'

function rendererProps(entity: ComposeEntity | undefined): JsonObject | undefined {
  const renderer = entity?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.renderer] as
    { readonly props?: JsonObject } | undefined
  return renderer ? renderer.props ?? {} : undefined
}

function isLocked(entity: ComposeEntity): boolean {
  const lock = entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.lock] as
    { readonly locked?: boolean } | undefined
  return lock?.locked === true
}

/**
 * 把一份 Renderer Props **patch** 写进一组 Entity。
 *
 * @remarks
 * **patch 合到每个目标各自的 props 上**，不是把某一条的整份 props 覆盖到全部——两条曲线一条
 * 线宽 2、一条线宽 5 时，拿前者的整份 props 去写后者，改个颜色会顺手把它的线宽也改成 2。
 * 这个错误在屏幕上看不见：用户改的是颜色，要等他去看那一条的线宽才发现。
 *
 * 产出**一条 batch**，因此多选批量改属性只占一步撤销。目标顺序按传入顺序，与选区一致。
 *
 * 跳过两类目标：没有 `Renderer` 的（容器没有 props 可写），以及**锁定**的。锁定这一档必须由
 * 规划这一层挡住而不是只靠面板置灰——面板只有一个 `readOnly`，而选区可以半锁半不锁，那时
 * 面板是可写的，写进去就等于把锁绕开了。调用方要把「有几条没写」说给用户听：静默跳过会让
 * 用户以为写进去了。
 *
 * 一个目标都不剩时返回 `null` 而**不是**一条空 batch——空事务照样进撤销历史，之后撤销一步
 * 什么都不发生，而屏幕上没有东西解释为什么。
 *
 * 单选是这一组恰好一个成员的退化情形，与文字样式的四件事、时间线的关键帧选区是同一条判断。
 *
 * @param idFactory - 宿主提供的命令 id 工厂。
 * @returns 一条 batch 命令；没有任何可写目标时为 `null`。
 * @public
 */
export function planComposeSetRendererProps(input: {
  readonly document: ComposeDocument
  readonly entityIds: readonly string[]
  /** 要写入的键值；只有出现在这里的键被改写，其余原样保留。 */
  readonly patch: JsonObject
  /**
   * 要**删掉**的键。
   *
   * @remarks
   * 与「写一个值回去」是两件事：可缺席的排版字段（`lineHeight`）缺席那一档，渲染与测量读出
   * 的是 `normal`，而写一个数回去等于把「自动」固化成一个值。patch 表达不了删除——`JsonObject`
   * 里没有 `undefined`，因此单列一条。
   */
  readonly removeKeys?: readonly string[]
  readonly idFactory: () => string
  /** 事务标签；缺席时按目标数量生成。 */
  readonly label?: string
}): EditorCommand | null {
  const commands: EditorCommand[] = []
  const targetIds: string[] = []
  for (const entityId of input.entityIds) {
    const entity = input.document.entities[entityId]
    if (!entity || isLocked(entity)) continue
    const props = rendererProps(entity)
    if (!props) continue
    const next = { ...props, ...input.patch }
    for (const key of input.removeKeys ?? []) delete next[key]
    commands.push({
      id: input.idFactory(),
      type: BUILTIN_COMMAND_TYPES.setRendererProps,
      payload: { entityId, props: next },
    })
    targetIds.push(entityId)
  }
  if (commands.length === 0) return null
  return {
    id: input.idFactory(),
    type: BUILTIN_COMMAND_TYPES.batch,
    payload: { commands: commands as unknown as JsonObject[] },
    meta: {
      label: input.label ?? `Update ${targetIds.length} object(s)`,
      source: 'inspector',
      targetIds,
      /*
       * 合并键按**这一批**与被改的字段定：连续拖同一个色板只合成一条历史，而换一批对象或换
       * 一个字段就是另一次编辑。不带字段名的话，改完颜色再改线宽会被并进同一条，撤销一步
       * 两样一起回去。
       */
      mergeKey: `inspector:${targetIds.join(',')}:renderer:${
        [...Object.keys(input.patch), ...(input.removeKeys ?? [])].sort().join(',')
      }`,
    },
  }
}

/**
 * 找出一组 Entity 之间**取值不一致**的 Renderer Prop 名称。
 *
 * @remarks
 * 只比较 `propNames` 里列出的那些：面板要问的是「我画出来的这几个字段里，哪些不是单值」，
 * 而不是「这几个对象的 props 有什么区别」。缺席与显式写下的默认值**算不同**——这里读的是
 * authored props，而「这个字段作者写没写过」本来就是两种状态。
 *
 * 比较走 JSON 序列化：props 是 `JsonValue`，没有函数与循环引用，而按引用比会把两份内容相同
 * 的对象判成不同。
 *
 * 少于两个目标时恒为空集——一个对象自己不会与自己混合。
 *
 * @public
 */
export function findComposeMixedRendererProps(input: {
  readonly document: ComposeDocument
  readonly entityIds: readonly string[]
  readonly propNames: readonly string[]
}): ReadonlySet<string> {
  const propsList = input.entityIds
    .flatMap((entityId) => {
      const props = rendererProps(input.document.entities[entityId])
      return props ? [props] : []
    })
  if (propsList.length < 2) return new Set()
  const mixed = new Set<string>()
  for (const name of input.propNames) {
    const first = JSON.stringify(propsList[0]?.[name] ?? null)
    if (propsList.some((props) => JSON.stringify(props[name] ?? null) !== first)) mixed.add(name)
  }
  return mixed
}
