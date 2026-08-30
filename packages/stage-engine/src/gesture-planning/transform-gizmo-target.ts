import { getComposeTransformPivot } from '@compose-ui/core'
import type { ComposeDocument, ComposeLayoutSnapshot } from '@compose-ui/core'
import { applyMatrix, type StageMatrix, type StagePoint, type StageRect } from '../geometry'

/**
 * 求指示器中心所需的最小几何来源。
 *
 * @remarks
 * 刻意**不要求整个 `StageSceneIndex`**（它结构上满足本接口）：手势期的指示器要跟着**预览**
 * 文档走，而为每一帧预览建一次全场景索引是一次整棵树的遍历，而这里只需要目标那一条祖先链。
 *
 * @public
 */
export interface StageTransformGizmoSource {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  getWorldMatrix(entityId: string): StageMatrix | null
}

/** 指示器与旋转共用的中心与轴向。 @public */
export interface StageTransformGizmoTarget {
  /** 中心的世界坐标。 */
  readonly center: StagePoint
  /** X 轴方向角（度）；多选时为 0。 */
  readonly degrees: number
}

const RADIANS_PER_DEGREE = Math.PI / 180

/**
 * 这一次变换绕哪个点转、轴指向哪里。
 *
 * @remarks
 * **单选时中心是那个 Entity 自己的旋转基点**——用户设 `Transform.pivot` 就是为了绕它转
 * （刀闸的铰点在刀身一端），绕包围盒中心转等于把他刚设的那件事作废。
 *
 * 这不是锦上添花：预览的分解（`targetTransform`）读的就是 Entity 自己的基点，世界矩阵这一侧
 * 若绕包围盒中心构造，两边基点不一致，差额会被写进 `LayoutItem.offset`——症状是「只想刻角度，
 * 位置也被刻了一帧」，且提交后对象跳一下，位移量恰好是 `2·|基点偏移|·sin(θ/2)`。
 * `matrixFromTransform` 与 `decomposeMatrix` 必须拿到同一个基点，这里是那条不变量的另一半。
 *
 * 轴向取该 Entity 局部 +X 在世界里的方向，而不是直接读 `Transform.rotation`：后者不含祖先的
 * 旋转，嵌在转过的容器里时轴会与对象差一个角度。视口没有旋转，因此世界角等于屏幕角。
 *
 * **多选退回选区包围盒中心、轴对齐**：那时没有单一基点（各有各的 `pivot`），也没有单一
 * `rotation`。默认基点就是盒中心，因此绝大多数对象的行为一个像素都不变。
 *
 * @param source - 几何来源；手势期传预览文档，指示器因此跟着对象一起动。
 * @param ids - 本次变换的目标（已过滤成可变换的那些）。
 * @param bounds - 选区包围盒，多选与读不到几何时的回退。
 * @public
 */
export function resolveTransformGizmoTarget(
  source: StageTransformGizmoSource,
  ids: readonly string[],
  bounds: StageRect,
): StageTransformGizmoTarget {
  const boxCenter = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  if (ids.length !== 1) return { center: boxCenter, degrees: 0 }
  const id = ids[0]!
  const entity = source.document.entities[id]
  const world = source.getWorldMatrix(id)
  // 取 Snapshot 的已求解盒，与预览分解读的是同一份——回读 LayoutItem fallback 会在 Hug
  // 或 Fill 的对象上给出另一个尺寸，基点于是又偏了。
  const box = source.layoutSnapshot.boxes[id]
  if (!entity || !world || !box) return { center: boxCenter, degrees: 0 }
  const pivot = getComposeTransformPivot(entity)
  const origin = applyMatrix(world, { x: 0, y: 0 })
  const unitX = applyMatrix(world, { x: 1, y: 0 })
  return {
    center: applyMatrix(world, { x: pivot.x * box.width, y: pivot.y * box.height }),
    // 屏幕 Y 轴向下，因此角度取负——与 `距离<角度` 的坐标写法同一套约定。
    degrees: Math.atan2(-(unitX.y - origin.y), unitX.x - origin.x) / RADIANS_PER_DEGREE,
  }
}
