/**
 * 内核用到的全部文档相关类型，打成一个类型级记录。
 *
 * @remarks
 * 内核逻辑本身完全不认识文档，只有类型签名认识。用单个 profile 而不是六个类型参数，是为了
 * 不把泛型化的成本转嫁给消费者——否则每个插件、每个会话工厂与每条测试夹具的签名上都要
 * 重复这六个类型，新增一个内核类型就要改遍所有签名。
 *
 * 仲裁器仍按 `pointerId` 判定「这个事件属不属于当前会话」，这是指针语义在泛型内核里的唯一
 * 一处泄漏，已知且刻意保留——见 refactor-kernel-generics 的 design.md。
 *
 * @public
 */
export interface InteractionKernelProfile {
  /** 最新受控上下文。 */
  readonly context: unknown
  /** 与上下文同一求解周期的空间索引。 */
  readonly index: unknown
  /**
   * 归一化输入事件的联合。
   *
   * @remarks
   * 只约束为 object，因为仲裁器要用 `in` 判定事件是否携带指针绑定。不写成
   * `{ readonly pointerId?: number }`：只含可选属性的类型是 weak type，不携带 `pointerId`
   * 的事件变体会因「没有共同属性」而无法赋值。
   */
  readonly event: object
  /**
   * 询问 claim 的那个事件变体。
   *
   * @remarks
   * 由 profile 声明而不是由内核推导：内核若写死 `Extract<event, { type: 'pointer.down' }>`，
   * 就假设了交互一定由指针按下发起。命令驱动的文档类型（CAD 的 `L↵`）不成立。
   */
  readonly claimEvent: unknown
  /** 发往 surface 的效果。 */
  readonly effect: unknown
  /** 对外发布的快照。 */
  readonly snapshot: unknown
}

/**
 * 内核提供给插件的运行时上下文。
 *
 * @remarks
 * 插件 MUST NOT 自行组装或发布 snapshot 之外的状态，也 MUST NOT 直接持有 surface：
 * 快照的派生字段由内核在 {@link InteractionPluginContext.publish} 中统一补齐，绕过它会让
 * 派生字段缺失。
 *
 * @public
 */
export interface InteractionPluginContext<K extends InteractionKernelProfile> {
  /** 最新受控 context；与 `index` 属于同一求解周期。 */
  readonly context: K['context']
  /** 与 `context` 对应的空间索引。 */
  readonly index: K['index']
  /**
   * 当前快照的只读视图。
   *
   * @remarks
   * 读的必须是访问当刻的值，而不是插件注册或会话创建时捕获的那一份：部分内核状态跨会话
   * 存活并在会话之外变化（例如按住空格期间的 `temporaryPan`），claim 依赖它做判定。
   */
  readonly snapshot: K['snapshot']
  /** 向 surface 发出效果；空数组是合法的 no-op。 */
  apply(effects: readonly K['effect'][]): void
  /** 发布快照，内核负责补齐派生字段并通知订阅者。 */
  publish(snapshot: K['snapshot']): void
  /**
   * 保留跨会话内核状态的空闲快照，作为插件发布时的基线。
   *
   * @remarks
   * 由内核提供而不是导出一个裸函数：「空闲」意味着哪些字段归零、哪些字段必须留下
   * （目前是 `temporaryPan`）是内核的规则，让每个插件自行拼装等于把这条规则复制 N 份，
   * 将来新增一个跨会话字段就要逐个插件去改。
   */
  idleSnapshot(): K['snapshot']
}

/**
 * 一次被接管的交互会话。
 *
 * @remarks
 * 生命周期是 `update`（零次或多次）→ `commit` 或 `cancel`，二者互斥且各至多一次。
 *
 * `update` MUST NOT 写文档，只更新预览与快照；`commit` MUST 至多规划一个命令或 batch；
 * `cancel` MUST 丢弃全部预览，用于 Escape、并发文档变化与会话释放。
 *
 * 仲裁器保证 `commit` 之前已用 pointerup 的点与修饰键调用过一次 `update`，因此 `commit`
 * 不接收终点参数——见 {@link InteractionSessionArbiter.commit}。
 *
 * @public
 */
export interface InteractionSession<K extends InteractionKernelProfile> {
  /**
   * 会话绑定的指针。
   *
   * @remarks
   * 仲裁器据此丢弃其他指针的事件；多点触控下第二根手指不会打断进行中的手势。
   */
  readonly pointerId: number
  /**
   * 推进会话。
   *
   * @remarks
   * 收到的不只是 `pointer.move`：`temporary-pan.start` / `temporary-pan.end` 等非指针事件
   * 同样转发给活动会话（move 手势用它表达「锁定原父级」）。会话对不关心的事件 MUST 无副作用地忽略。
   */
  update(event: K['event'], ctx: InteractionPluginContext<K>): void
  commit(ctx: InteractionPluginContext<K>): void
  /**
   * 丢弃预览并收尾。
   *
   * @remarks
   * 与 `commit` 一样接收 ctx：会话在 claim/update 里发布过快照、捕获过指针，取消时必须由
   * 它自己还原——内核不知道某个会话发布过什么。
   */
  cancel(ctx: InteractionPluginContext<K>): void
  /**
   * 本会话是否把临时平移键（Space）重新解释为自己的修饰键。
   *
   * @remarks
   * 移动手势用 Space 表达「锁定原父级」而不是临时平移——两种意图不会同时出现，手势进行中也
   * 无法再按下第二个指针开始平移。声明为 `true` 时内核把 `temporary-pan.start` /
   * `temporary-pan.end` 只转发给本会话，不再切换 `temporaryPan` 标志。
   *
   * 由会话自报而不是让内核按插件 id 列表判断：后者会把手势知识重新塞回内核，正是插件化要
   * 消除的耦合，而且每新增一个移动入口就要改内核一次。
   *
   * @defaultValue false
   */
  readonly consumesTemporaryPan?: boolean
  /**
   * 受控上下文变化后，本会话是否仍然成立。
   *
   * @remarks
   * 并发的文档或布局变化 MUST 中止引用具体对象的空间手势——被拖动的目标可能已经被别处的
   * 编辑移动、改尺寸甚至删除，继续沿用手势开始时冻结的几何会提交出错误的变换。
   *
   * 判据由会话自己给出而不是由内核枚举手势种类：只有会话知道自己引用了哪些对象、
   * 依赖了哪部分上下文。返回 `false` 时内核取消该会话。
   *
   * 省略即视为始终成立——适用于不引用任何对象的会话（例如平移只改视口、绘制只由世界
   * 坐标定义，两者都不应被并发文档变化打断）。
   */
  isCompatibleWith?(next: K['context'], nextIndex: K['index']): boolean
}

/**
 * `claim` 的三态结果。
 *
 * @remarks
 * `'consumed'` 表示这次按下已经被处理掉，但不产生拖拽会话，且仲裁器 MUST 停止询问其余插件。
 * 现有实现里文字编辑守卫（在编辑目标或变换手柄上按下）与 `tool === 'rotate'` 的兜底就是
 * 这种语义：用 `null` 会让仲裁器继续问下一个插件而改变行为，用空会话则会凭空产生一次
 * `commit`。
 *
 * @public
 */
export type InteractionClaimResult<K extends InteractionKernelProfile> =
  InteractionSession<K> | 'consumed' | null

/**
 * 可替换的交互单元。
 *
 * @remarks
 * 插件是纯状态机：不碰 React、不碰 DOM，输入是归一化事件与 {@link InteractionPluginContext}，
 * 输出是预览、快照与效果。
 *
 * @public
 */
export interface InteractionPlugin<K extends InteractionKernelProfile> {
  /** 注册表内唯一；重复注册会被拒绝。 */
  readonly id: string
  /**
   * 询问顺序，数值大的先被询问。
   *
   * @remarks
   * 这个数值取代了原实现中「`begin()` 里 if 分支的先后」这一隐式优先级。顺序错位会静默改变
   * 「同一次按下由谁接管」，因此新增插件时必须对照消费方声明的优先级表。
   */
  readonly priority: number
  /** 纯判定是否接管本次按下；MUST NOT 产生副作用之外的文档写入。 */
  claim(event: K['claimEvent'], ctx: InteractionPluginContext<K>): InteractionClaimResult<K>
}
