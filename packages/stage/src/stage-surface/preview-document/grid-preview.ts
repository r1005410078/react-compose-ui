import {
  getComposeGridItem,
  type ComposeDocument,
  type ComposeGridItem,
} from '@compose-ui/core'
import {
  createStageSceneIndex,
  resolveStageGridContext,
  solveStageGrid,
  type StageDropTarget,
} from '@compose-ui/stage-engine'

/**
 * 为网格里的 move 手势构造实时布局求解用的瞬态文档。
 *
 * @remarks
 * 写进去的是**整份求解结果**，被拖的那一个也在内。曾经刻意不写它，理由是「它由
 * previewTransforms 跟着光标走，吸格会让拖动一顿一顿」——**那条理由不成立**：
 * `transformLayoutSnapshot` 是整盒替换（直接写 `transform.x/y/width/height`），被拖对象的
 * 视觉位置完全由覆盖决定，文档里写什么都影响不到它。
 *
 * 而不写它会让推挤**在屏幕上永远看不见**：交给 Runtime 的文档变成「兄弟被推到了下面，而被
 * 拖的那张还在原格」——没有任何东西占着那个位置，于是 Runtime 自己那趟求解的**重力把兄弟原样
 * 浮回去**，一帧之内撤销了推挤。写上之后这份文档就是一个自洽的格局（「此刻松手会是什么样」），
 * 而求解是幂等的，Runtime 重解一遍等于原样返回。
 *
 * 分工因此仍然成立：影子回答「松手会变成什么」，跟手的卡回答「我现在拖到哪了」，而文档回答
 * 「现在整块板子是什么格局」。
 *
 * 推挤结果来自 core 的那一个求解器（经 `solveStageGrid`），与提交时走的是同一条路径，因此
 * 「拖动中看到的让位」与「松手后的结果」必然一致。
 *
 * 跨容器拖入不在这里处理：此刻目标还不是那个容器的子级，把它插进去等于在预览里做一次结构
 * 变更。那一档由占位影子承担反馈。
 *
 * @returns 求解用文档；没有任何兄弟需要让位时返回 null，表示无需实时求解。
 * @internal
 */
export function buildGridPreviewSolveDocument(
  previewDocument: ComposeDocument,
  committedDocument: ComposeDocument,
  dropTarget: StageDropTarget | null,
  draggedIds: readonly string[],
  layoutSnapshot: Parameters<typeof createStageSceneIndex>[1],
): ComposeDocument | null {
  if (dropTarget?.kind !== 'grid-cell') return null
  const leadId = draggedIds[0]
  if (!leadId) return null
  // 索引读**提交态**文档：拖动中的目标已被预览变形，而推挤要按兄弟的真实位置算。
  const index = createStageSceneIndex(committedDocument, layoutSnapshot)
  const context = resolveStageGridContext(index, dropTarget.containerId)
  if (!context) return null
  const existing = getComposeGridItem(committedDocument.entities[leadId])
  const solved = solveStageGrid(index, dropTarget.containerId, context, {
    id: leadId,
    x: dropTarget.x,
    y: dropTarget.y,
    // 跨度跟着这次手势走：缩放会带来新的跨度，移动不带，那一档沿用已提交值。
    w: dropTarget.w ?? existing?.w ?? 4,
    h: dropTarget.h ?? existing?.h ?? 2,
  })

  let changed = false
  const entities = { ...previewDocument.entities }
  for (const cell of solved) {
    const entity = entities[cell.id]
    const before = entity && getComposeGridItem(entity)
    if (!entity || !before) continue
    if (before.x === cell.x && before.y === cell.y
      && before.w === cell.w && before.h === cell.h) continue
    const next: ComposeGridItem = { ...before, x: cell.x, y: cell.y, w: cell.w, h: cell.h }
    entities[cell.id] = {
      ...entity,
      components: { ...entity.components, GridItem: next },
    }
    changed = true
  }
  return changed ? { ...previewDocument, entities } : null
}
