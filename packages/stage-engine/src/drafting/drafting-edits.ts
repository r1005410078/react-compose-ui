import { BUILTIN_COMMAND_TYPES, getComposeLock, type ComposeDocument, type ComposeLayoutSnapshot, type EditorCommand } from '@compose-ui/core'
import { createDuplicateCommand } from '../commands'
import { translationMatrix } from '../geometry'
import {
  planTransformCommit,
  resolveTransformTargets,
  transformedSelection,
} from '../gesture-planning'
import type { StageSceneIndex } from '../hit-testing'
import type { StageDraftingEffect } from './drafting-types'

/** {@link planStageDraftingEdits} 的输入。 @public */
export interface StageDraftingEditQuery {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly index: StageSceneIndex
  readonly effect: StageDraftingEffect
  readonly idFactory: () => string
}

/**
 * 把一次绘图命令效果中**针对既有 Entity** 的部分规划成文档命令。
 *
 * @remarks
 * 新建曲线不在这里：它需要 Registry 决定 Preset，因此留在宿主。平移、复制与删除只认识文档，
 * 因此住在无 React 的引擎里，可以喂输入直接测。
 *
 * **平移与拖动手势共用提交漏斗 `planTransformCommit`，但不共用拖动预览**：
 *
 * - 拖动预览里的激活阈值区分「点一下」与「拖一下」，而命令没有这个歧义——用户已经明确取了
 *   两个点，沿用它会让小位移的 `MOVE` 静默什么也不做。
 * - 拖动预览里的平移吸附在命令路径上是**违规**的：基点与位移点已经各自经过点输入管线
 *   （指针取点吸过、键入坐标刻意没吸），再吸一次会改写键入的坐标。
 * - 拖动预览里的落点解析会跨父级重挂载，而 `MOVE` 是纯平移：用户敲 `M` 的意图是「挪一段
 *   距离」，不是「放进那个容器」。要重挂载就用拖动。
 *
 * 因此共用点定在 `planTransformCommit`——它同时是 resize 与 rotate 的提交口，产出**一条**
 * 变换命令，多选移动因此只占一步撤销。
 *
 * @returns 按顺序派发即可；没有可提交内容时为空数组。
 * @public
 */
export function planStageDraftingEdits(query: StageDraftingEditQuery): readonly EditorCommand[] {
  const { document, layoutSnapshot, index, effect, idFactory } = query
  const commands: EditorCommand[] = []

  if (effect.translate && effect.translate.entityIds.length > 0) {
    const { entityIds, delta } = effect.translate
    const targets = resolveTransformTargets({ document, index, type: 'move', ids: entityIds })
    if (targets) {
      const transforms = transformedSelection(
        index,
        targets.editableIds,
        translationMatrix(delta.x, delta.y),
      )
      const planned = planTransformCommit({
        document,
        layoutSnapshot,
        index,
        finished: { type: 'move', ids: targets.editableIds, transforms },
        idFactory,
      })
      if (planned?.type === 'command.dispatch') commands.push(planned.command)
    }
  }

  if (effect.duplicate && effect.duplicate.entityIds.length > 0) {
    const { entityIds, delta } = effect.duplicate
    // 顶层收敛：父子同时选中时复制父级已经带上子级，再复制一次子级会多出一份。
    for (const sourceId of index.topLevelSelection(entityIds)) {
      const duplicated = createDuplicateCommand(
        document,
        sourceId,
        idFactory,
        idFactory(),
        undefined,
        delta,
      )
      if (duplicated) commands.push(duplicated.command)
    }
  }

  if (effect.removed && effect.removed.length > 0) {
    // 锁定对象不删：锁保护的正是「别动我」，而 ERASE 是最不可逆的那一种动。
    const entityIds = effect.removed.filter((id) => {
      const entity = document.entities[id]
      return entity !== undefined && !getComposeLock(entity).locked
    })
    if (entityIds.length > 0) {
      commands.push({
        id: idFactory(),
        type: BUILTIN_COMMAND_TYPES.deleteEntity,
        payload: { entityIds },
        meta: {
          label: `Delete ${entityIds
            .map((id) => document.entities[id]?.name ?? id)
            .join(', ')}`,
          source: 'stage',
          targetIds: entityIds,
        },
      })
    }
  }

  return commands
}
