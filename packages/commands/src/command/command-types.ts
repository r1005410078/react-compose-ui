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
 * 一条可由名称启动的命令。
 *
 * @remarks
 * `start` 每次调用产出独立会话，因此同一条命令可以被反复执行而不互相污染。
 *
 * @public
 */
export interface ComposeCommandDefinition<TContext, TEffect> {
  /** 命令的稳定标识，同时是用户可键入的全名，例如 `LINE`。 */
  readonly id: string
  /** 其他可键入的写法，例如 `L`。匹配不区分大小写。 */
  readonly aliases?: readonly string[]
  /** 已本地化的显示名。 */
  readonly title: string
  start(context: TContext): ComposeCommandSession<TEffect>
}
