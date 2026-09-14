import {
  composeComponentFileName,
  composePageFileName,
  createEmptyComposePageFile,
  validateComposeDocument,
  COMPOSE_COMPONENT_SCHEMA_VERSION,
  type ComposeBaseComponentAsset,
  type ComposeEntity,
  type ComposePosition,
  type JsonObject,
} from '@compose-ui/core'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposeComponentStore } from '@compose-ui/component-library'
import { createComposeComponentInstanceEntity } from '@compose-ui/component-library'
import type { ComposePageDescriptor, ComposePageStore } from '@compose-ui/pages'
import { uniqueComposeAssetFileName } from '../asset-naming'
import {
  assembleDxfDocument,
  planDxfImport,
  type DxfDiagnostic,
  type DxfEntitySeed,
  type DxfInstancePlan,
} from '@compose-ui/dxf'

/** 一次导入的结果。 @internal */
export interface ImportDxfAsPageResult {
  readonly page: ComposePageDescriptor
  /** 没有被完整表达的内容；空数组表示全部导入。 */
  readonly diagnostics: readonly DxfDiagnostic[]
}

/** {@link importDxfAsPage} 的参数。 @internal */
export interface ImportDxfAsPageInput {
  readonly text: string
  /** 页面与场景的名称，通常取 `.dxf` 的文件名。 */
  readonly name: string
  readonly parentId: string | null
  /** 用于列举目标目录，给落盘的文件名去重。 */
  readonly provider: ComposeAssetProvider
  readonly registry: ComposeEntityRegistry
  readonly componentStore: ComposeComponentStore
  readonly pageStore: ComposePageStore
  readonly idFactory: () => string
}

/** 基点缺席即盒中心，因此中心不写进文档——没设过基点的实例与今天逐像素相同。 */
function isBoxCenter(pivot: ComposePosition) {
  return pivot.x === 0.5 && pivot.y === 0.5
}

function placeInstance(entity: ComposeEntity, plan: DxfInstancePlan): ComposeEntity {
  const layoutItem = entity.components.LayoutItem as JsonObject
  const transform = entity.components.Transform as JsonObject
  const nextTransform: JsonObject = {
    ...transform,
    rotation: plan.rotation,
    ...(isBoxCenter(plan.pivot) ? null : { pivot: { x: plan.pivot.x, y: plan.pivot.y } }),
  }
  return {
    ...entity,
    components: {
      ...entity.components,
      LayoutItem: { ...layoutItem, offset: { x: plan.offset.x, y: plan.offset.y } },
      Transform: nextTransform,
    },
  }
}

/**
 * 把一份 DXF 导入成页面与组件资产。
 *
 * @remarks
 * 资源写入是两类：组件文件先写，因为实例需要它们的引用与 revision——那正是纯函数计划里
 * **不含**实例 Entity 的理由。
 *
 * 组件写成功而页面写失败时不回滚：资源写入是不可回滚的外部副作用，删掉刚写的文件比留着更
 * 容易造成损失。这与「创建组件」那条路径的判断一致。
 *
 * @internal
 */
export async function importDxfAsPage(
  input: ImportDxfAsPageInput,
): Promise<ImportDxfAsPageResult> {
  /*
   * seed 按 Preset 记住：计划层只读它、只展开它（`{ ...seed.components }`），从不就地改写，
   * 因此同一个 Preset 的每个 Entity 共用一份是安全的。不记的话一份 5381 实体的图纸要过
   * 5381 次 Preset 校验，实测占打开时间的四分之一强。
   */
  const seeds = new Map<string, DxfEntitySeed | null>()
  const plan = planDxfImport(input.text, {
    createSeed: (presetId: string) => {
      const cached = seeds.get(presetId)
      if (cached !== undefined) return cached
      const created = input.registry.createSeed(presetId)
      const seed = created.ok ? created.seed : null
      seeds.set(presetId, seed)
      return seed
    },
    idFactory: input.idFactory,
    sceneName: input.name,
  })

  const instances: Record<string, ComposeEntity> = {}
  const assets = new Map<string, { asset: ComposeBaseComponentAsset; assetKey: string; revision: string }>()
  /*
   * 落盘的文件名必须在目标目录里去重。**块名天生会撞**：`CCSYM00200102` 这类名字来自标准
   * 符号库，同一家设计院出的两张图带着同名的块；再导一次同一张图更是必撞。不去重的症状是
   * 抛 `Asset "…" already exists`，而用户没做错任何事。
   *
   * 目录只列举一次，本次导入自己写下的名字随写随记——`createComponent` 之后再列一遍会把
   * 一次导入变成 N 次往返，而那份清单在下一次写入之前就已经过期。
   */
  const taken = new Set((await input.provider.list({
    folderId: input.parentId ?? input.provider.root.id,
  })).map((entry) => entry.name))
  for (const component of plan.components) {
    const asset: ComposeBaseComponentAsset = {
      schemaVersion: COMPOSE_COMPONENT_SCHEMA_VERSION,
      kind: 'base',
      componentId: input.idFactory(),
      name: component.blockName,
      document: component.document,
    }
    const fileName = uniqueComposeAssetFileName(
      composeComponentFileName,
      component.blockName,
      taken,
    )
    const snapshot = await input.componentStore.createComponent({
      parentId: input.parentId,
      fileName,
      asset,
    })
    assets.set(component.blockName, {
      asset,
      assetKey: snapshot.assetKey,
      revision: snapshot.revision,
    })
  }

  for (const instance of plan.instances) {
    const written = assets.get(instance.blockName)
    if (!written) continue
    const created = createComposeComponentInstanceEntity({
      registry: input.registry,
      id: instance.id,
      asset: written.asset,
      reference: input.componentStore.createReference(written.assetKey),
      revision: written.revision,
    })
    if (!created.ok) continue
    instances[instance.id] = placeInstance(created.entity, instance)
  }

  const document = assembleDxfDocument(plan, instances)
  if (!document) {
    throw new Error('DXF 导入未能装配出完整页面文档')
  }
  // 非法内容不落盘：写下去之后用户看到的是一个打不开的页面，而问题出在几步之前。
  const validation = validateComposeDocument(document)
  if (!validation.valid) {
    throw new Error(`DXF 导入产出的文档非法：${
      validation.issues.map(({ message }) => message).join('；')
    }`)
  }

  const page = await input.pageStore.createPage({
    parentId: input.parentId,
    fileName: uniqueComposeAssetFileName(composePageFileName, input.name, taken),
    page: {
      ...createEmptyComposePageFile(),
      document,
      // 导入的那块场景就是发布目标：一份 DXF 就是一张图。
      activeFrameId: plan.scene.frameId,
    },
  })

  return { page, diagnostics: plan.diagnostics }
}
