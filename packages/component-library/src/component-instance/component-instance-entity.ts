import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createComposeResolvedComponentSnapshot,
  getComposeLayoutItem,
  type ComposeComponentAssetV1,
  type ComposeComponentReference,
  type ComposeEntity,
  type JsonObject,
} from '@compose-ui/core'

/** 关联组件实例实体的创建结果。 @public */
export type CreateComposeComponentInstanceEntityResult =
  | { readonly ok: true; readonly entity: ComposeEntity }
  | { readonly ok: false; readonly reason: string }

/**
 * 从 Registry 的隐藏 `component-instance` Preset 创建带离线快照的关联实例实体。
 *
 * @remarks
 * Registry Preset 只提供物料基础组合；项目资源身份、Provider revision 与离线快照由本函数
 * 写入。最终位置由 Stage 抽取规划器在原子替换命令中设置。
 *
 * @public
 */
export function createComposeComponentInstanceEntity(input: {
  readonly registry: ComposeEntityRegistry
  readonly id: string
  readonly asset: ComposeComponentAssetV1
  readonly reference: ComposeComponentReference
  readonly revision: string
}): CreateComposeComponentInstanceEntityResult {
  const created = input.registry.createSeed('component-instance')
  if (!created.ok) {
    return {
      ok: false,
      reason: `Registry 缺少 component-instance Preset：${created.error.message}`,
    }
  }
  const snapshot = createComposeResolvedComponentSnapshot(
    input.asset,
    input.reference,
    input.revision,
  )
  const item = getComposeLayoutItem({ id: input.id, ...created.seed })
  const rendererProps = {
    reference: input.reference,
    resolvedSnapshot: snapshot,
    propertyOverrides: {},
  } as unknown as JsonObject
  return {
    ok: true,
    entity: {
      id: input.id,
      name: input.asset.name,
      components: {
        ...created.seed.components,
        LayoutItem: {
          ...item,
          positioning: 'absolute',
          width: { ...item.width, mode: 'hug', value: snapshot.document.output.width },
          height: { ...item.height, mode: 'hug', value: snapshot.document.output.height },
        },
        GeometryConstraints: { movable: true, resize: 'none', rotatable: true },
        Renderer: { type: 'component-instance', props: rendererProps },
      },
    },
  }
}
