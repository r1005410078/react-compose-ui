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
/**
 * 会话可声明接受的输入种类。
 *
 * @remarks
 * `pick` 是「落在对象上的点」：既不是 `point`（它不过点输入管线——吸附会把落点挪到光标底下那
 * 截线之外，而用户瞄的正是那截线；等待它的一步也不算「正在取点」），也不是 `selection`
 * （它要说出落在对象的**哪儿**，且不改选择集）。
 */
export type ComposeCommandInputKind = 'point' | 'text' | 'keyword' | 'selection' | 'pick'

/** 一个可在提示中键入的关键字选项。 @public */
export interface ComposeCommandKeyword {
  /** 用户键入的短标识，匹配时不区分大小写。 */
  readonly key: string
  /** 已本地化的显示名。 */
  readonly label: string
}

/**
 * 一步取点的数值参数化。
 *
 * @remarks
 * 说的是「这一步的两个数怎么算出来」：
 *
 * | 值 | 两个字段 | 原点 |
 * | --- | --- | --- |
 * | `absolute` | X、Y | 无（世界坐标） |
 * | `polar` | 距离、角度 | 上一个点 |
 * | `cartesian` | 宽、高 | 上一个点 |
 * | `radius` | 半径（**只有一个**） | 圆心 |
 * | `diameter` | 直径（**只有一个**） | 圆心 |
 * | `angle` | 角度（**只有一个**） | 旋转中心 |
 *
 * `radius`、`diameter` 与 `angle` 是**单字段**参数化：呈现只出一个框，`Tab` 不接管（没有
 * 第二个字段可去），因此也不存在锁定这一档——锁定是 `Tab` 的产物。圆是旋转对称的，半径点
 * 的角度对结果没有任何影响；旋转同理，到中心的距离对结果没有任何影响。一个永远不影响结果
 * 的只读字段比没有更差。
 *
 * **原点不在这里**：它就是会话已经上报的那个 `reference`（橡皮筋的起点），把同一个点放进
 * 两个地方只能靠约定保持一致。
 *
 * 本包零运行时依赖，连坐标都不认识，因此这里只是一个**标签**，数学由宿主做——`core` 那边
 * 有一个逐字相同的联合，这处重复是包边界造成的。
 *
 * @public
 */
export type ComposeCommandPointFields =
  | 'absolute'
  | 'polar'
  | 'cartesian'
  | 'radius'
  | 'diameter'
  | 'angle'

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
  /**
   * 这一步的数值参数化；缺省表示这一步不显示数值。
   *
   * @remarks
   * 选择对象、取基点这类步骤没有可读出的量，缺省时宿主的呈现与从前完全一致。
   */
  readonly fields?: ComposeCommandPointFields
  /**
   * 这一步在光标旁印什么；缺省表示不印。
   *
   * @remarks
   * `fields` 说的是「这一步的**点**怎么参数化」，而有的步骤要的根本不是点——`POLYGON` 的
   * 边数就是一个数加一个二选一。命令行在图面底部，用户的眼睛此刻在光标上，「敲一个数」
   * 这句话说在他没有在看的地方等于没说。
   *
   * **它只是呈现，不是第五种输入端**：输入仍然只有命令行一个。宿主据此画框、并把 `Tab`
   * 派发成 `toggle.keyword`；宿主 MUST NOT 解析或校验 `value`——那是命令自己的规则。
   *
   * 判据 MUST 由提示声明而 MUST NOT 由宿主按命令 id 反推：宿主不认识任何一条命令的内部。
   */
  readonly cursorInput?: {
    /** 数值框里印的当前值（例如默认边数 `6`）；用户正在键入时由缓冲覆盖。 */
    readonly value: string
    /**
     * 这一步的二选一档位；缺省表示这一步没有档位。
     *
     * @remarks
     * 档位不是一个能键入的数，因此宿主 MUST 把它画成与数值框**形状不同**的东西，且它
     * MUST NOT 参与 `Tab` 的字段轮转——那会把焦点带到一个打不了字的地方。`Tab` 直接派发
     * `keyword`，与在命令行敲它逐字等价。
     */
    readonly toggle?: {
      /** 已本地化的当前档位文案，例如「内接」。 */
      readonly value: string
      /** 切到另一档要派发的关键字，例如 `C`。 */
      readonly keyword: string
    }
  }
  /**
   * 标注量的那一段要不要由标注自己画出来；缺省不画。
   *
   * @remarks
   * **标注量的那一段必须画出来**——不画它，标注的两条延伸线就从空处伸出来，用户读不出这个
   * 数说的是什么。但由谁画取决于它是不是形状的一部分：`LINE` 的预览线**就是**被量的那一段
   * （再画一遍就是同一条线加粗），而 `CIRCLE` 的预览是整圆、半径线不在里面。
   *
   * 因此由提示声明而不由呈现层推导：只有命令知道自己的预览几何里含不含这一段，呈现层拿到的
   * 只是一串预览折线，从里面反查「有没有一段正好从原点到落点」既贵又脆。
   *
   * 这**不是**「预览几何与橡皮筋互斥」的例外：那一条禁止的是同一个问题答两遍，而半径线与圆
   * 回答的是两个问题——形状是什么、你落在圆上的哪个点。
   */
  readonly measured?: boolean

  /**
   * 这一步的落点被钉死在某种角度约束上，与会话级的那个三态设置无关。
   *
   * @remarks
   * **约束与辅助是两回事。** 会话级的角度约束是用户的偏好（关 / 正交 / 极轴），它**辅助**用户
   * 落在整齐的方向上；而有些命令的产物按行业规范**必须**是某个方向——导线在一次接线图与 PCB
   * 上一律横平竖直，斜着走的导线不是「用户的选择」而是一张画错的图。
   *
   * 它由**提示**声明而不由宿主按命令 id 判断：哪一步该被钉死只有命令知道（`WIRE` 的第一个点
   * 没有上一点，因此不钉；从第二个点起才钉），而宿主拿到的只是一个提示。
   *
   * 钉死的是落点解算里**角度约束那一档**，因此既有的管线次序原样成立——
   * `键入 > 捕捉 > 网格 > 角度约束`。推论有两条，都是想要的：**捕捉命中时短路**，最后一段
   * 够得着端口而不会被正交挡在门外；**键入的坐标不被改写**，用户打出来的精确值仍然是精确值。
   *
   * @defaultValue 缺席即跟随会话级设置
   */
  readonly constrain?: 'ortho'
  /**
   * 这一步要在光标旁画的徽标；缺席不画。
   *
   * @remarks
   * 由**提示自己声明**而不由宿主按命令 id 反推，与 `cursorInput` 同一条判断。它只是呈现，
   * 不改变任何输入的解释。v1 只有剪刀：等待选择对象的命令画的是同一个拾取框，而 `ERASE` 与
   * `TRIM` 都删东西——两条命令光标一模一样、差别只写在屏幕底部，用户的眼睛此刻却在光标上。
   */
  readonly badge?: 'scissors'
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
  /**
   * 一个或多个落在对象上的点。
   *
   * @remarks
   * `targets` 是数组：一笔拖过多个对象时 MUST 作为**一次**输入推进——一次输入、一个事务。
   * 点一下是长度为 1 的退化情形。标识对本包仍是不透明字符串，点只是两个数。
   */
  | {
      readonly kind: 'pick'
      readonly targets: readonly { readonly id: string; readonly point: ComposeCommandPoint }[]
    }
  /** 直接确认；有 `defaultKeyword` 时等价于键入它，否则被拒绝。 */
  | { readonly kind: 'accept' }
  /** 取消整条命令。 */
  | { readonly kind: 'cancel' }

/**
 * 会话推进一步的结果。
 *
 * @remarks
 * `rejected` **不结束会话**：多步取点里点错位置、打错关键字是常态，结束整条命令会让用户把
 * 已经走完的几步重来一遍。宿主显示 `message` 后按原提示继续等待。
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
  | {
      readonly status: 'cancelled'
      /**
       * 放弃时要回收的东西。
       *
       * @remarks
       * 只服务**中途落地过**的会话（在 `prompt` 那一档带过 `commit`）：它已经把东西写进文档
       * 了，「放弃」因此必须说得出要回收什么——宿主手上只有一份会话句柄，无从得知这一条在
       * 文档里留下了哪些痕迹。
       *
       * 绝大多数会话中途什么都不提交，它们不带这个字段，行为与从前逐字相同。
       */
      readonly effect?: TEffect
    }
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
  /**
   * 「如果落在这里，结果会是什么样」。
   *
   * @remarks
   * 这是一个**查询**而不是第五种输入：它不改会话状态、不产生事务，可以每帧调任意多次而不
   * 影响随后的 `advance`。把光标位置做成输入是错的——`advance` 是状态机，每帧一次
   * `pointermove` 就推进一次会让「取了几个点」跟着鼠标动，而撤销、关键字与提示都挂在那个
   * 计数上。
   *
   * 可选：本包零运行时依赖且对效果类型泛型，既有命令不该因为新增一个呈现能力而全部要改。
   * 未实现时宿主退回自己既有的呈现（例如一条橡皮筋）。
   *
   * @param point - 候选落点，已经过宿主的点输入管线解算。
   * @returns 这一步的候选效果；`null` 表示这一步没有可呈现的内容（取基点、选对象都是）。
   */
  preview?(point: ComposeCommandPoint): TEffect | null
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
  /**
   * 提交之后立刻以同一条命令重开一次**全新**会话。
   *
   * @remarks
   * 「画完之后接着画」是**这条命令自己的性质**，不是画布的状态——因此它是定义上的一个标记，
   * 不是宿主的一个模式。做成模式会让同一条命令在两种模式下行为不同，而屏幕上没有任何东西
   * 说明为什么；做成标记则「哪些命令会接着画」可以从注册处读出来。
   *
   * 重开的会话**不继承上一条的任何输入**：继承上一条的终点会让两点命令退化成链，而那是
   * `LINE` 的语义，不是这条命令的。
   *
   * 本包**不实现重开**——它零运行时依赖、不持有会话，这只是一个供宿主解释的标签。
   *
   * @defaultValue `false`（提交即结束，与未引入本字段时完全一致）
   */
  readonly repeat?: boolean

  start(context: TContext): ComposeCommandSession<TEffect>
}
