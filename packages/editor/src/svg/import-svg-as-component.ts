import {
  composeComponentFileName,
  validateComposeDocument,
  COMPOSE_COMPONENT_SCHEMA_VERSION,
  type ComposeBaseComponentAsset,
  type ComposeDocument,
  type ComposeEntity,
  type JsonObject,
} from '@compose-ui/core'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposeComponentSnapshot, ComposeComponentStore } from '@compose-ui/component-library'
import { planSvgImport, type SvgDiagnostic, type SvgPendingAsset } from '@compose-ui/svg-import'

/** 一次导入的结果。 @internal */
export interface ImportSvgAsComponentResult {
  readonly component: ComposeComponentSnapshot
  /** 没有被完整表达的内容；空数组表示全部导入。 */
  readonly diagnostics: readonly SvgDiagnostic[]
}

/** {@link importSvgAsComponent} 的参数。 @internal */
export interface ImportSvgAsComponentInput {
  readonly text: string
  /** 组件与文件的名称，通常取 `.svg` 的文件名。 */
  readonly name: string
  readonly parentId: string | null
  readonly registry: ComposeEntityRegistry
  readonly componentStore: ComposeComponentStore
  readonly provider: ComposeAssetProvider
  readonly idFactory: () => string
}

/** base64 → Blob；`atob` 在浏览器与现代 Node 里都有，导入器本身不碰它。 */
function toBlob(base64: string, mediaType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mediaType })
}

/**
 * 把待写资源写盘，并把引用回填进对应 Entity。
 *
 * @remarks
 * 纯函数计划里**不含**资源引用，因为它要等文件写完才存在——这与「组件实例不在 DXF 计划里」
 * 是同一条次序。写失败的那一张图跳过：少一张图片是可见的降级，而整份导入失败会连正确的几何
 * 一起丢掉。
 */
async function attachAssets(
  document: ComposeDocument,
  assets: readonly SvgPendingAsset[],
  input: ImportSvgAsComponentInput,
): Promise<ComposeDocument> {
  if (assets.length === 0) return document
  const parentId = input.parentId ?? input.provider.root.id
  const createFile = input.provider.createFile
  if (!createFile || input.provider.capabilities.createFile === false) return document
  let entities = document.entities
  for (const asset of assets) {
    const entity = entities[asset.entityId]
    if (!entity) continue
    let entry
    try {
      entry = await createFile.call(input.provider, {
        parentId,
        name: asset.fileName,
        content: toBlob(asset.base64, asset.mediaType),
      })
    }
    catch {
      continue
    }
    if (!entry.assetKey) continue
    entities = { ...entities, [asset.entityId]: withAsset(entity, {
      providerId: input.provider.id,
      assetKey: entry.assetKey,
      scope: input.provider.referenceScope ?? 'persistent',
    }) }
  }
  return { ...document, entities }
}

function withAsset(entity: ComposeEntity, reference: JsonObject): ComposeEntity {
  const renderer = (entity.components.Renderer ?? {}) as JsonObject
  return {
    ...entity,
    components: {
      ...entity.components,
      Renderer: {
        ...renderer,
        props: { ...((renderer.props ?? {}) as JsonObject), asset: reference },
      },
    },
  }
}

/**
 * 把一份 SVG 导入成组件资产。
 *
 * @remarks
 * 内嵌位图先写、组件文件后写：组件文档里的引用要等资源写完才存在，这与 DXF「组件文件先写、
 * 实例后建」是同一条次序。
 *
 * 位图写成功而组件写失败时不回滚：资源写入是不可回滚的外部副作用，删掉刚写的文件比留着更
 * 容易造成损失。这与 DXF 导入与「创建组件」两条既有路径的判断一致。
 *
 * **不在这里实例化**：导入之后用户要做的是**改这个符号**（改色、挂端口、打动画），那要在组件
 * 文档里做；把它摆到图上是另一件事，组件库的拖放入口已经做了，再造一个等于同一个动作有两条路。
 *
 * @internal
 */
export async function importSvgAsComponent(
  input: ImportSvgAsComponentInput,
): Promise<ImportSvgAsComponentResult> {
  const plan = planSvgImport(input.text, {
    createSeed: (presetId: string) => {
      const created = input.registry.createSeed(presetId)
      return created.ok ? created.seed : null
    },
    idFactory: input.idFactory,
    name: input.name,
  })
  if (!plan) throw new Error('这份文件里没有 <svg> 根元素')

  const document = await attachAssets(plan.component.document, plan.assets, input)
  // 非法内容不落盘：写下去之后用户看到的是一个打不开的组件，而问题出在几步之前。
  const validation = validateComposeDocument(document)
  if (!validation.valid) {
    throw new Error(`SVG 导入产出的文档非法：${
      validation.issues.map(({ message }) => message).join('；')
    }`)
  }

  const asset: ComposeBaseComponentAsset = {
    schemaVersion: COMPOSE_COMPONENT_SCHEMA_VERSION,
    kind: 'base',
    componentId: input.idFactory(),
    name: input.name,
    document,
  }
  const component = await input.componentStore.createComponent({
    parentId: input.parentId,
    fileName: composeComponentFileName(input.name),
    asset,
  })
  return { component, diagnostics: plan.diagnostics }
}
