/**
 * 手势接管优先级表。
 *
 * @remarks
 * 每一项对应 `interaction-controller.ts` 中 `begin()` 级联的一个分支，`sourceLine` 是抄录时
 * 的原行号，供评审逐行核对。**顺序就是语义**：原实现里「谁先判定谁接管」只体现为 if 分支的
 * 先后，任何错位都会静默改变同一次按下由谁处理，而多数错位不会有测试直接失败。
 *
 * 数值之间留 100 的间隔，方便步骤 3 在两项之间插入而不必重排全表。
 *
 * **本表在当前阶段尚未生效**：legacy 单体插件内部仍走原级联，注册表里只有它一个插件。
 * 表在这里先被单测锁定，等步骤 3 拆出第二个插件时才真正承担仲裁职责——这样「建立表」与
 * 「依赖表」分成两步，风险不叠加。
 *
 * @public
 */
export interface StageGesturePriorityEntry {
  /** 目标插件 id；步骤 3 拆分时按此命名。 */
  readonly id: string
  /** 询问优先级，数值大的先被询问。 */
  readonly priority: number
  /**
   * `begin()` 中对应分支的原行号（抄录时的 `interaction-controller.ts`）。
   *
   * @remarks
   * 只有从那次级联抄录而来的项有行号，它用于独立校验抄录顺序。**后来新增的插件没有原行号**
   * ——它们从未出现在级联里，编一个数字反而会让「行号同序」这条校验失去意义。
   */
  readonly sourceLine?: number
  /** 该分支的判定条件，用抄录时的表达式原样描述。 */
  readonly condition: string
}

/**
 * 按 `begin()` 实际行序抄录的优先级表。
 *
 * @remarks
 * `'consumed'` 语义的分支（文字编辑守卫）在表中同样占位：它「已消费但不开会话」，用 `null`
 * 表达会让仲裁器继续询问后续插件而改变行为。
 *
 * `rotate` 工具连同它的三项（`rotate-tool`、`legacy-rotate-hit`、`rotate-tool-fallback`）
 * 已经删除：旋转的入口改为变换指示器的圆环。判据是「模式必须是对象作用域且有明确的进出」
 * ——`rotate` 是工具也就是模式，切过去之后每一次拖动的含义都变了；指示器打开之后只有把手上
 * 的拖动有新含义。`gizmo`(1200) **不是**它们的替代，位置与条件都不同。
 *
 * @public
 */
export const STAGE_GESTURE_PRIORITY: readonly StageGesturePriorityEntry[] = Object.freeze([
  { id: 'text-edit-guard', priority: 1800, sourceLine: 1702, condition: 'context.textEditing 且命中编辑目标或变换手柄（consumed）' },
  { id: 'pan', priority: 1700, sourceLine: 1719, condition: 'snapshot.temporaryPan || button === 1' },
  { id: 'drafting-point', priority: 1650, condition: '绘图命令正在等待一个点（consumed）' },
  { id: 'paint-sample', priority: 1500, sourceLine: 1875, condition: 'context.paintSampling 存在' },
  { id: 'path', priority: 1400, sourceLine: 1896, condition: "hit.kind === 'path-handle'" },
  { id: 'paint', priority: 1300, sourceLine: 1940, condition: "hit.kind === 'paint-handle'" },
  { id: 'curve-corner', priority: 1250, condition: "hit.kind === 'curve-corner'" },
  { id: 'gizmo', priority: 1200, condition: "hit.kind === 'gizmo-handle'" },
  { id: 'draw', priority: 1000, sourceLine: 2038, condition: 'isDrawingTool(tool) 且命中 surface 或 entity' },
  { id: 'geometry-edit-fallback', priority: 850, condition: "clickCount === 2 且命中 surface 或会收敛成框选的容器体，且盒内含可几何编辑对象（consumed）" },
  { id: 'marquee-converge', priority: 800, sourceLine: 2075, condition: "hit.kind === 'entity' 且 shouldConvergeToMarquee" },
  { id: 'entity-select-move', priority: 700, sourceLine: 2088, condition: "hit.kind === 'entity'（含双击进入文字编辑）" },
  { id: 'resize', priority: 600, sourceLine: 2118, condition: "hit.kind === 'resize'" },
  { id: 'guide-create', priority: 400, sourceLine: 2129, condition: "hit.kind === 'ruler' || 'ruler-corner'" },
  { id: 'guide-move', priority: 300, sourceLine: 2171, condition: "hit.kind === 'guide'" },
  { id: 'marquee-fallback', priority: 100, sourceLine: 2198, condition: '无条件兜底 startMarquee()' },
])

