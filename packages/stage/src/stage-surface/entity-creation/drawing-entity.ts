import type { ComposeEntitySeed } from '@compose-ui/component-registry'
import {
  adoptComposeCrossAxisSizing,
  getComposeLayoutItem,
  getComposeSpatialTransform,
  type ComposeCurve,
  type ComposeEntity,
  type ComposeFlexLayout,
  type JsonObject,
  type JsonValue,
} from '@compose-ui/core'
import type { StagePoint, StageRect } from '@compose-ui/stage-engine'

/**
 * 用 Preset 的默认尺寸将 Entity 放在指定世界中心。
 *
 * @remarks
 * 目标父级是 Auto Layout 容器时（传入 `parentLayout`），新 Entity 以 Flow 进入排队并按
 * 交叉轴采纳规则改写尺寸——与画布 reparent 的 `targetManagesFlow` 判定一致，避免同一个
 * 「放进容器」动作在拖入创建与拖动换父两条路径上得到不同结果。
 * @internal
 */
export function entityFromSeed(
  seed: ComposeEntitySeed,
  id: string,
  center: StagePoint,
  parentLayout?: ComposeFlexLayout,
): ComposeEntity {
  const transform = getComposeSpatialTransform({ id: '__seed__', ...seed })
  const placed = {
    ...getComposeLayoutItem({ id: '__seed__', ...seed }),
    offset: {
      x: center.x - transform.size.width / 2,
      y: center.y - transform.size.height / 2,
    },
  }
  return {
    id,
    name: seed.name,
    components: {
      ...structuredClone(seed.components),
      Transform: { rotation: transform.rotation },
      LayoutItem: parentLayout
        ? adoptComposeCrossAxisSizing({ ...placed, positioning: 'flow' }, parentLayout)
        : placed,
    },
  }
}

/** 绘制拖拽被视为「单击」的世界尺寸阈值。 @internal */
const DRAWING_CLICK_EPSILON = 1

/**
 * 把单击（没有有效拖拽）的绘制 bounds 展开为 Preset 默认尺寸，按下点作为左上角。
 *
 * @remarks
 * `entityFromDrawingSeed` 对非 Hug 轴一律写 `Math.max(1, bounds.*)`，因此不加干预时单击
 * 会得到 1×1 的退化 Entity。默认尺寸取自 Preset 自身的 Transform，Stage 因此不需要认识
 * 具体物料的常量。
 * @internal
 */
export function expandClickDrawingBounds(seed: ComposeEntitySeed, bounds: StageRect): StageRect {
  if (bounds.width >= DRAWING_CLICK_EPSILON || bounds.height >= DRAWING_CLICK_EPSILON) return bounds
  const { size } = getComposeSpatialTransform({ id: '__seed__', ...seed })
  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(1, size.width),
    height: Math.max(1, size.height),
  }
}

/**
 * 将绘制 bounds 映射为独立 Entity；Text click 会保留 Preset 的 Hug 轴。
 *
 * @remarks
 * `curve` 是**盒局部坐标**的真实几何（原点在 `bounds` 左上角）。方向因此由两个坐标的差
 * 表达，不再需要 Shape 那套 `direction ∈ {-1,0,1}²` 编码——多一层编码就多一处要与渲染、
 * 命中、捕捉分别对齐的表示。退化轴由曲线自己的最小范围常量钳住，因此也不再需要那个
 * 「零轴按 0.5px 偏移」的补丁。
 *
 * @internal
 */
export function entityFromDrawingSeed(
  seed: ComposeEntitySeed,
  id: string,
  bounds: StageRect,
  curve?: ComposeCurve,
  options?: {
    readonly preserveHugSizing?: boolean
    /**
     * 需要清空的可原地编辑文本 Prop 名称。
     *
     * 点击创建的文字会立刻进入编辑，光标应当落在空内容上；留着 Preset 的占位文案会逼
     * 用户先全选删除再打字。Prop 名由调用方从 Registry 查得，本模块不认识具体物料。
     */
    readonly emptyTextPropName?: string
  },
): ComposeEntity {
  const seeded = entityFromSeed(seed, id, {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  })
  const item = getComposeLayoutItem(seeded)
  const renderer = seeded.components.Renderer
  return {
    ...seeded,
    components: {
      ...seeded.components,
      LayoutItem: {
        ...item,
        positioning: 'absolute',
        offset: { x: bounds.x, y: bounds.y },
        width: {
          ...item.width,
          mode: options?.preserveHugSizing ? item.width.mode : 'fixed',
          value: options?.preserveHugSizing ? item.width.value : Math.max(1, bounds.width),
        },
        height: {
          ...item.height,
          mode: options?.preserveHugSizing ? item.height.mode : 'fixed',
          value: options?.preserveHugSizing ? item.height.value : Math.max(1, bounds.height),
        },
      },
      ...(curve ? { Curve: curve as unknown as JsonObject } : {}),
      ...(renderer && options?.emptyTextPropName
        ? {
            Renderer: {
              ...renderer,
              props: {
                ...(renderer.props as Record<string, JsonValue>),
                [options.emptyTextPropName]: '',
              },
            },
          }
        : {}),
    },
  }
}

/** Preset 默认尺寸在给定世界中心处的包围盒。 @internal */
export function seedWorldBounds(seed: ComposeEntitySeed, center: StagePoint): StageRect {
  const { size } = getComposeSpatialTransform({ id: '__seed__', ...seed })
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
  }
}

/** 包围盒中心点。 @internal */
export function boundsCenter(bounds: StageRect): StagePoint {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}
