import { getCadInsert, getCadLine, getCadPlacement, type CadDocument } from '../document'
import type { CadSegment } from '../geometry'
import { transformCadBlockPoint } from './cad-block-transform'

/**
 * 图纸上一条可见线段，连同它归属哪个顶层 Entity。
 *
 * @remarks
 * `ownerId` 是**顶层**对象：块实例内的线段全部归属该实例。命中与框选的结果必须是实例而不是
 * 块内图元——块内图元不是图纸上的独立对象，选中它们会让「删除」失去明确目标。
 *
 * @public
 */
export interface CadVisibleSegment {
  readonly ownerId: string
  readonly segment: CadSegment
}

/**
 * 求出图纸上全部可见线段。
 *
 * @remarks
 * 命中、框选与对象捕捉共用这一条遍历：三者对「什么算可见」必须给出同一个答案，各自实现会在
 * 块实例这类展开逻辑上分叉——点得中却捕不到是最难排查的一类不一致。
 *
 * 块实例在这里被**展开**而不是当作不可分的整体：插完一个断路器之后要能从它的接线端点起笔画
 * 导线，看不见端点等于块只是一张贴图。
 *
 * 隐藏图层不参与。实例自身的图层决定整个实例的可见性——块内图元各自的图层只在块定义内部有
 * 意义，让它们能单独隐藏会使同一个块在不同插入处呈现不同，那不是块。
 *
 * @param document - 当前文档。
 * @returns 全部可见线段，顺序与 `rootIds` 一致。
 * @public
 */
export function collectCadVisibleSegments(document: CadDocument): readonly CadVisibleSegment[] {
  const visibleLayers = new Set(
    document.layers.filter(({ visible }) => visible).map(({ id }) => id),
  )
  const result: CadVisibleSegment[] = []

  for (const id of document.rootIds) {
    const entity = document.entities[id]
    if (!entity) continue
    if (!visibleLayers.has(getCadPlacement(entity)?.layerId ?? '')) continue

    const line = getCadLine(entity)
    if (line) {
      result.push({ ownerId: id, segment: line })
      continue
    }

    const insert = getCadInsert(entity)
    if (!insert) continue
    const block = document.blocks[insert.blockId]
    // 悬空引用已被文档校验拦下；能走到这里只可能是外部写入，静默跳过好过画出半个符号。
    if (!block) continue
    for (const memberId of block.rootIds) {
      const member = block.entities[memberId]
      const memberLine = member ? getCadLine(member) : undefined
      if (!memberLine) continue
      result.push({
        ownerId: id,
        segment: {
          start: transformCadBlockPoint(memberLine.start, insert),
          end: transformCadBlockPoint(memberLine.end, insert),
        },
      })
    }
  }
  return result
}
