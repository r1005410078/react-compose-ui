import type { ComposeKeybinding } from '../keybinding'

/**
 * 一步提示接受的输入种类。
 *
 * @remarks
 * `accept` 与 `cancel` 不在此列——它们是流程控制而非数据，任何一步都接受。
 *
 * `selection` 是一批对象标识；对本包而言只是字符串，本包不解释它们指向什么。
 *
 * @public
 */
export type ComposeCommandInputKind = 'point' | 'text' | 'keyword' | 'selection'

/** 一个可在提示中键入的关键字选项。 @public */
export interface ComposeCommandKeyword {
  /** 用户键入的短标识，匹配时不区分大小写。 */
  readonly key: string
  /** 已本地化的显示名。 */
  readonly label: string
}

/**
 * 命令当前等待的一步输入。
 *
 * @remarks
 * 提示由命令自己产出而不是由宿主拼装：只有命令知道这一步要什么、有哪些分支可走。宿主只负责
 * 把它显示出来并按 `accepts` 决定该不该把画布上的点交给它。
 *
 * @public
 */
export interface ComposeCommandPrompt {
  /** 已本地化的提示文本，例如「指定第一点」。 */
  readonly message: string
  /** 本步接受的输入种类；不在其中的输入会被拒绝。 */
  readonly accepts: readonly ComposeCommandInputKind[]
  /** 可键入的关键字，例如 `[闭合(C)/放弃(U)]`。 */
  readonly keywords?: readonly ComposeCommandKeyword[]
  /** 直接确认（Enter）时等价于键入的关键字；缺省表示确认无效。 */
  readonly defaultKeyword?: string
}

/** 世界坐标中的一个点。 @public */
export interface ComposeCommandPoint {
  readonly x: number
  readonly y: number
}

/**
 * 喂给命令会话的一次输入。
 *
 * @public
 */
export type ComposeCommandInput =
  | { readonly kind: 'point'; readonly point: ComposeCommandPoint }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'keyword'; readonly key: string }
  /**
   * 一批对象标识。
   *
   * @remarks
   * 标识对本包是**不透明字符串**：本包不认识任何文档协议，也不解释这些标识指向什么。它存在
   * 的意义是让「先选后执行」与「先执行后选」共用同一条状态机——命令要么在启动上下文里拿到
   * 选择，要么自己提示，收到的是同一种东西。
   */
  | { readonly kind: 'selection'; readonly ids: readonly string[] }
  /** 直接确认；有 `defaultKeyword` 时等价于键入它，否则被拒绝。 */
  | { readonly kind: 'accept' }
  /** 取消整条命令。 */
  | { readonly kind: 'cancel' }

/**
 * 会话推进一步的结果。
 *
 * @remarks
 * `rejected` **不结束会话**：输入不合法在 CAD 里是常态（点错、打错关键字），结束命令会让
 * 用户从头再来。宿主显示 `message` 后按原提示继续等待。
 *
 * @public
 */
export type ComposeCommandStep<TEffect> =
  | {
      readonly status: 'prompt'
      readonly prompt: ComposeCommandPrompt
      /** 当前的预览效果；宿主据此绘制未提交的几何。 */
      readonly preview?: TEffect
      /**
       * 本步**已经产出**的变更；宿主派发它，但会话继续。
       *
       * @remarks
       * 与 `commit` 状态的区别是会话不结束。AutoCAD 的 `COPY` 放下一个副本之后继续等下一个
       * 落点，直到用户显式结束——把同一个符号摆一排是高频动作，每放一个都要重敲一次命令会让
       * 用户放弃使用它。
       *
       * 与 `preview` 的区别是**已经落进文档**：`preview` 是还没提交、用来画的几何，本字段是
       * 已经发生的事实。两者可以同时出现。
       */
      readonly commit?: TEffect
    }
  | { readonly status: 'commit'; readonly effect: TEffect }
  | { readonly status: 'cancelled' }
  | { readonly status: 'rejected'; readonly message: string }

/**
 * 一次命令执行。
 *
 * @remarks
 * 会话自己跑状态机：宿主只转发输入并渲染 `prompt` 与 `preview`，不理解命令有几步。
 *
 * @public
 */
export interface ComposeCommandSession<TEffect> {
  /**
   * 当前等待的输入；随 `advance` 返回的 `prompt` 更新。
   *
   * @remarks
   * `null` 表示这一步**不需要任何输入**，宿主 MUST 立即以 `accept` 推进。命令能从启动上下文
   * 里拿全所需信息时走这条路——AutoCAD 里先选好对象再敲 `E↵`，对象立刻就删了，不会再问一句
   * 「选择对象」。没有这一档的话，这种命令只能靠宿主认识它是哪条命令来特判。
   */
  readonly prompt: ComposeCommandPrompt | null
  advance(input: ComposeCommandInput): ComposeCommandStep<TEffect>
}

/**
 * 一条命令的可呈现信息。
 *
 * @remarks
 * 这半边是**列出、检索与判断可用性**所需的全部，因此它**不带泛型**：只需要把命令摆出来的
 * 消费者（命令面板）不应被 `TContext` / `TEffect` 这两个它永远不使用的类型参数传染。
 * 「谁能列出命令」与「谁能跑命令」因此是两个不同的门槛。
 *
 * @public
 */
export interface ComposeCommandDescriptor {
  /** 命令的稳定标识，同时是用户可键入的全名，例如 `LINE`。 */
  readonly id: string
  /** 其他可键入的写法，例如 `L`。匹配不区分大小写。 */
  readonly aliases?: readonly string[]
  /** 已本地化的显示名。 */
  readonly title: string
  /** 结果分组标题；省略时归入未分组区。 */
  readonly category?: string
  /** 除名称与别名外的额外检索词。 */
  readonly keywords?: readonly string[]
  /** 仅用于展示的键位；本包不注册任何监听。 */
  readonly shortcut?: readonly ComposeKeybinding[]
  /**
   * 非空表示命令此刻不能执行，同时作为原因展示给用户。
   *
   * @remarks
   * 是**已本地化的文案**而不是稳定标识：本包不认识界面语言，翻译由产出描述符的一方完成。
   *
   * 可用性是描述符自己的字段而不是注册表上的查询——列出命令的一方拿到的是一份描述符列表
   * 而不是注册表，做成查询会让两处各自判断而漂移。
   */
  readonly disabledReason?: string
}

/**
 * 一条可由名称启动的命令。
 *
 * @remarks
 * `start` 每次调用产出独立会话，因此同一条命令可以被反复执行而不互相污染。
 *
 * @public
 */
export interface ComposeCommandDefinition<TContext, TEffect> extends ComposeCommandDescriptor {
  start(context: TContext): ComposeCommandSession<TEffect>
}
