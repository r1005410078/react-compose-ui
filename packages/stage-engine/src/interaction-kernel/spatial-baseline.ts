import type { StageInteractionContext } from '../interaction-controller'

/**
 * 判定一个冻结几何的会话在新上下文下是否仍然成立。
 *
 * @public
 */
export type StageSpatialBaselineCheck = (next: StageInteractionContext) => boolean

/**
 * 为引用了冻结几何的会话捕获上下文基线。
 *
 * @remarks
 * 「冻结几何」指会话在 claim 时算好、之后不再重算的量——旋转中心、外接盒、基准角度、
 * 起始局部坐标等。这类量一旦与文档脱节，提交出来的就是错误的变换，而错误不会在交互中
 * 显形：预览照常跟着指针走，只有落库的数值是错的。
 *
 * 因此判据是三项**恒等**比较，而不是「目标还在不在」：
 * - `document` 引用变化——别处的编辑动过任何 Entity，冻结的几何可能已经失真；
 * - `layoutSnapshot.revision` 变化——Auto Layout 重排会在文档不变的情况下挪动世界坐标；
 * - `tool` 变化——工具切换意味着用户已经离开这次手势表达的意图。
 *
 * 与「上一份 context」比较和与「claim 时的 context」比较是等价的：任何一项变化都会立即
 * 中止会话，所以只要会话还活着，这三项自 claim 起就没变过。捕获式实现让会话不必自己维护
 * 「上一份 context」。
 *
 * 不引用冻结几何的会话 MUST NOT 使用本基线——平移只改视口、绘制只由世界坐标定义、取色
 * 每帧从当前文档重新求值，把它们绑在文档恒等上只会制造无谓的中断。
 *
 * @param context - claim 当刻的受控上下文。
 * @returns 接收新上下文、返回基线是否仍然成立的谓词。
 * @public
 */
export function captureStageSpatialBaseline(
  context: StageInteractionContext,
): StageSpatialBaselineCheck {
  const { document, tool } = context
  const layoutRevision = context.layoutSnapshot.revision
  return (next) => next.document === document
    && next.layoutSnapshot.revision === layoutRevision
    && next.tool === tool
}
