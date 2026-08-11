import type { ComposeEntitySeed } from '@compose-ui/component-registry'
import {
  getComposeLayoutItem,
  getComposeSpatialTransform,
  type ComposeEntity,
  type JsonValue,
} from '@compose-ui/core'
import type { StagePoint, StageRect } from '@compose-ui/stage-engine'

/** 两点 Shape 在各轴上的几何朝向。 @internal */
export type ShapeDirection = {
  readonly x: -1 | 0 | 1
  readonly y: -1 | 0 | 1
}

/** 用 Preset 的默认尺寸将 Entity 放在指定世界中心。 @internal */
export function entityFromSeed(
  seed: ComposeEntitySeed,
  id: string,
  center: StagePoint,
): ComposeEntity {
  const transform = getComposeSpatialTransform({ id: '__seed__', ...seed })
  return {
    id,
    name: seed.name,
    components: {
      ...structuredClone(seed.components),
      Transform: { rotation: transform.rotation },
      LayoutItem: {
        ...getComposeLayoutItem({ id: '__seed__', ...seed }),
        offset: {
          x: center.x - transform.size.width / 2,
          y: center.y - transform.size.height / 2,
        },
      },
    },
  }
}

/** 将绘制 bounds 映射为独立 Entity；Text click 会保留 Preset 的 Hug 轴。 @internal */
export function entityFromDrawingSeed(
  seed: ComposeEntitySeed,
  id: string,
  bounds: StageRect,
  direction?: ShapeDirection,
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
        offset: {
          x: direction?.x === 0 ? bounds.x - 0.5 : bounds.x,
          y: direction?.y === 0 ? bounds.y - 0.5 : bounds.y,
        },
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
      ...(renderer && (direction || options?.emptyTextPropName)
        ? {
            Renderer: {
              ...renderer,
              props: {
                ...(renderer.props as Record<string, JsonValue>),
                ...(direction ? { direction: direction as unknown as JsonValue } : {}),
                ...(options?.emptyTextPropName ? { [options.emptyTextPropName]: '' } : {}),
              },
            },
          }
        : {}),
    },
  }
}
