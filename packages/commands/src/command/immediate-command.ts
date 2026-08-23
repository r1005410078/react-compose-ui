import type {
  ComposeCommandDefinition,
  ComposeCommandDescriptor,
  ComposeCommandSession,
  ComposeCommandStep,
} from './command-types'

/** {@link createComposeImmediateCommand} 的输入。 @public */
export interface ComposeImmediateCommandInput<TEffect> extends ComposeCommandDescriptor {
  /**
   * 立即执行的动作。
   *
   * @remarks
   * 动作所需的一切依赖在**注册时闭包捕获**，不经由命令启动上下文传入：上下文一旦并成所有
   * 命令依赖的并集，每加一条命令就要往它上面加一个绝大多数命令用不到的字段。
   */
  run(): void
  /**
   * 提交时携带的效果；缺省为空对象。
   *
   * @remarks
   * 副作用已经在 `run()` 里发生，因此绝大多数一次性动作提交的是一个空效果。字段留在这里是
   * 为了让效果类型确实需要内容的宿主也能用这条捷径。
   */
  readonly effect?: TEffect
}

/**
 * 把一次性动作包装成命令定义。
 *
 * @remarks
 * 一次性动作是命令会话的**退化情形**——一个 `prompt` 为 `null`、收到确认就提交的会话。这个
 * 形态不是为本函数发明的：`ERASE` 在启动上下文里已经拿到选择集时，`prompt` 就是 `null`。
 *
 * 因此一次性动作 MUST NOT 成为与命令定义并列的第二种形状：它表达不了多步，而命令定义表达
 * 得了一步，合并方向是单向的。
 *
 * @param input - 命令的可呈现信息加一个立即执行的函数。
 * @returns 与手写会话命令完全同类的定义，可直接放进注册表。
 * @public
 */
export function createComposeImmediateCommand<TContext, TEffect>(
  input: ComposeImmediateCommandInput<TEffect>,
): ComposeCommandDefinition<TContext, TEffect> {
  const { run, effect, ...descriptor } = input
  return {
    ...descriptor,
    start(): ComposeCommandSession<TEffect> {
      return {
        prompt: null,
        advance(command): ComposeCommandStep<TEffect> {
          if (command.kind === 'cancel') return { status: 'cancelled' }
          // 退化会话只认识确认：它没有提示，任何别的输入都不该到达这里。
          if (command.kind !== 'accept') {
            return { status: 'rejected', message: descriptor.title }
          }
          run()
          return { status: 'commit', effect: (effect ?? {}) as TEffect }
        },
      }
    },
  }
}

/**
 * 立即执行的结果。
 *
 * @remarks
 * `needs-input` 携带**已经启动的会话**，因此调用方可以接着用它，不必再 `start()` 一次——
 * 启动两次会得到两条互不相干的会话，而第一条已经把副作用做过了。
 *
 * @public
 */
export type ComposeImmediateCommandOutcome<TEffect> =
  | { readonly status: 'ran'; readonly step: ComposeCommandStep<TEffect> }
  | { readonly status: 'needs-input'; readonly session: ComposeCommandSession<TEffect> }

/**
 * 跑一条命令，能一步跑完就跑完。
 *
 * @remarks
 * 这是跑退化会话的**唯一**实现：命令行与任何以「按名称执行一条命令」为入口的消费者都调用
 * 它，各自内联「`prompt` 为 `null` 就 accept」会让两处对同一条命令给出不同结果。
 *
 * 需要进一步输入时**不推进**会话：本函数不知道下一步的输入从哪来。
 *
 * @param definition - 要执行的命令。
 * @param context - 命令的启动上下文。
 * @returns 已经跑完的一步，或一条等待输入的会话。
 * @public
 */
export function runComposeCommandImmediately<TContext, TEffect>(
  definition: ComposeCommandDefinition<TContext, TEffect>,
  context: TContext,
): ComposeImmediateCommandOutcome<TEffect> {
  const session = definition.start(context)
  if (session.prompt !== null) return { status: 'needs-input', session }
  return { status: 'ran', step: session.advance({ kind: 'accept' }) }
}
