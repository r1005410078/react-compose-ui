/**
 * 布尔运算命令：拍平，以及（后续）并集、差集、交集与异或。
 *
 * @remarks
 * 五条都走 `ERASE` 那条**两条次序共用**的状态机：启动上下文里已经选够对象就当场提交
 * （`prompt` 为 `null`，宿主随即以 accept 推进），没选够就提示选择对象。这正是 AutoCAD 的
 * 先选后执行，也是选择集这一步存在的理由——两条路收到的是同一种输入。
 *
 * 会话**只管数量**：其余校验（有没有几何、锁没锁、有没有导线绑着）要读文档，而本包的命令层
 * 不认识文档，那些住在 `commands/curve-boolean.ts` 的解算里。
 */

import type {
  ComposeCommandDefinition,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import type {
  StageBooleanOperation,
  StageDraftingContext,
  StageDraftingEffect,
  StageDraftingMessages,
} from './drafting-types'

function selectPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  // Enter 表示「选完了」。没有 keywords，因此不给 defaultKeyword，由 accept 直接提交。
  return { message: messages.selectObjects, accepts: ['selection'] }
}

/**
 * 建立一次布尔运算的状态机。
 *
 * @param minimum - 这条运算至少需要几个操作数。拍平一个就够（把一个圆角矩形变成能拖控制
 *   手柄的路径是它最常见的用法），四条区域运算要两个。
 * @public
 */
export function createStageBooleanSession(
  context: StageDraftingContext,
  operation: StageBooleanOperation,
  minimum: number,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  let picked: readonly string[] = context.selection ?? []
  let prompt: ComposeCommandPrompt | null = picked.length >= minimum
    ? null
    : selectPrompt(messages)

  const commit = (): ComposeCommandStep<StageDraftingEffect> => {
    // 数量不够时 MUST 说明而不是什么都不做：「敲了没反应」与敲错字在屏幕上无法区分。
    if (picked.length < minimum) {
      return { status: 'rejected', message: messages.alignmentNeedsMore(minimum) }
    }
    return { status: 'commit', effect: { boolean: { operation, ids: picked } } }
  }

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind === 'selection') {
        // 替换而不是并入：选择集归宿主，会话只是镜像。
        picked = input.ids
        prompt = selectPrompt(messages)
        return { status: 'prompt', prompt }
      }
      if (input.kind === 'accept') return commit()
      return { status: 'rejected', message: messages.expectedSelection }
    },
  }
}

/**
 * 五条布尔运算的 id、别名与文案来源。
 *
 * @remarks
 * 别名照抄 AutoCAD 既有的 `UNI` / `SU` / `IN`——用户只记一套词。异或用 `XOR` 而不是 `EX`：
 * 后者要留给将来的 `EXTEND`，而一个词只能指一条命令。
 *
 * 四条区域运算至少要两个操作数；拍平一个就够——把一个圆角矩形变成能拖控制手柄的路径是它
 * 最常见的用法。
 */
const BOOLEAN_COMMANDS: readonly {
  readonly id: string
  readonly aliases: readonly string[]
  readonly operation: StageBooleanOperation
  readonly minimum: number
  readonly title: (messages: StageDraftingMessages) => string
}[] = [
  { id: 'UNION', aliases: ['UNI'], operation: 'union', minimum: 2, title: (m) => m.unionTitle },
  { id: 'SUBTRACT', aliases: ['SU'], operation: 'subtract', minimum: 2, title: (m) => m.subtractTitle },
  { id: 'INTERSECT', aliases: ['IN'], operation: 'intersect', minimum: 2, title: (m) => m.intersectTitle },
  { id: 'EXCLUDE', aliases: ['XOR'], operation: 'exclude', minimum: 2, title: (m) => m.excludeTitle },
  { id: 'FLATTEN', aliases: ['FLAT'], operation: 'flatten', minimum: 1, title: (m) => m.flattenTitle },
]

/** 五条布尔运算命令定义。 @public */
export function createStageBooleanCommands(
  messages: StageDraftingMessages,
): readonly ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect>[] {
  return BOOLEAN_COMMANDS.map(({ id, aliases, operation, minimum, title }) => ({
    id,
    aliases,
    title: title(messages),
    category: messages.editCategory,
    start: (context: StageDraftingContext) => createStageBooleanSession(context, operation, minimum),
  }))
}
