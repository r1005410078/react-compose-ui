import type { CadDocument } from '../document'
import { findCadEntitiesInBounds, findCadHit } from '../selection'
import type { CadInteractionContext, CadSceneIndex } from './cad-kernel-profile'

/**
 * 为一次求解周期建立命中索引。
 *
 * @remarks
 * 今天的实现就是对文档的线性遍历——图元数量真正上去之前，建索引要付的增量维护与失效成本
 * 没有证据支持。做成接口的意义在于插件完全不碰几何：将来换成空间索引时插件一行不改。
 *
 * @param document - 当前文档。
 * @param context - 提供命中容差；与 `document` 属于同一求解周期。
 * @public
 */
export function createCadSceneIndex(
  document: CadDocument,
  context: Pick<CadInteractionContext, 'hitTolerance'>,
): CadSceneIndex {
  return {
    hitTest: (point) => findCadHit(document, point, context.hitTolerance),
    hitBounds: (bounds, mode) => findCadEntitiesInBounds(document, bounds, mode),
  }
}
