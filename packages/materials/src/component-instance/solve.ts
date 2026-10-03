import {
  createComposeRendererMeasurementAdapter,
  type ComposeEntityRegistry,
} from '@compose-ui/component-registry'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  getComposeHierarchy,
  getComposeRenderer,
  getComposeVisibility,
  resolveComposeRenderedChildIds,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { resolveComposeDocumentLayout } from '@compose-ui/layout-engine'
import { prepareComposeComponentInstance, type ComposePreparedComponentInstance } from './prepare'

/**
 * 一个组件实例的嵌套求解结果：准备好的嵌套文档与它的布局快照，外加呈现参数。
 *
 * @public
 */
export type ComposeSolvedComponentInstance =
  Omit<Extract<ComposePreparedComponentInstance, { readonly ok: true }>, 'ok' | 'key'> & {
    readonly snapshot: ComposeLayoutSnapshot
  }

/**
 * 逐个准备并求解一棵子树里的组件实例（含嵌套实例），按复合地址索引。
 *
 * @remarks
 * 这是预览实例渲染器在浏览器之外的等价物：准备走同一个 {@link prepareComposeComponentInstance}，
 * 嵌套 Yoga 用与预览同一个测量端口工厂与 Registry 求解，因此量出来的文字盒与预览逐像素一致。
 * 地址规则与编辑器下钻相同：顶层实例就是它自己的 id，嵌套的是 `外层/内层`。
 *
 * 只走**会被渲染**的子树（跳过隐藏对象）；准备或求解失败的实例不出现在结果里，由消费方按
 * 「缺结果」兜底——预览在那里画失败状态，导出画同尺寸占位。
 *
 * 实例的盒取自传入的快照：`scale` 的比值要用它，而预览量自己的 DOM 得到的是同一个数（`fit:
 * none` 下）。
 *
 * PERF：每个实例各求解一次，同一组件放很多次就求很多次；需要时再按「组件引用 + 覆盖 + 盒尺寸」
 * 去重。
 *
 * @param input.document - 已解算的文档。
 * @param input.snapshot - 与文档成对的布局快照。
 * @param input.rootId - 从哪个 Entity 开始遍历（通常是要导出的场景）。
 * @param input.registry - 与预览同一个 Registry，供测量端口使用。
 * @param input.assetResolver - 与预览同一个资源解析器。
 *
 * @public
 */
export async function solveComposeComponentInstances(input: {
  readonly document: ComposeDocument
  readonly snapshot: ComposeLayoutSnapshot
  readonly rootId: string
  readonly registry: ComposeEntityRegistry
  readonly assetResolver?: ComposeAssetResolver
}): Promise<ReadonlyMap<string, ComposeSolvedComponentInstance>> {
  const solved = new Map<string, ComposeSolvedComponentInstance>()

  const visit = async (
    document: ComposeDocument,
    snapshot: ComposeLayoutSnapshot,
    entityId: string,
    prefix: string,
    ancestorKeys: readonly string[],
  ): Promise<void> => {
    const entity = document.entities[entityId]
    // 起点即使被隐藏也照样遍历：与导出「隐藏的根场景照样导出」一致。
    const isStart = prefix === '' && entityId === input.rootId
    if (!entity || (!isStart && !getComposeVisibility(entity).visible)) return
    const address = prefix ? `${prefix}/${entityId}` : entityId
    const renderer = getComposeRenderer(entity)
    if (renderer?.type === 'component-instance') {
      const box = snapshot.boxes[entityId]
      const prepared = prepareComposeComponentInstance({
        props: renderer.props,
        hostBox: box ? { width: box.width, height: box.height } : null,
        ancestorKeys,
      })
      if (!prepared.ok) return
      const adapter = createComposeRendererMeasurementAdapter({
        registry: input.registry,
        assetResolver: input.assetResolver,
      })
      let nestedSnapshot: ComposeLayoutSnapshot
      try {
        adapter.updateDocument(prepared.document)
        nestedSnapshot = await resolveComposeDocumentLayout(prepared.document, adapter)
      }
      catch {
        return
      }
      finally {
        adapter.dispose()
      }
      solved.set(address, {
        document: prepared.document,
        snapshot: nestedSnapshot,
        contentFit: prepared.contentFit,
        rootSize: prepared.rootSize,
        contentScale: prepared.contentScale,
        flipScale: prepared.flipScale,
      })
      for (const rootId of prepared.document.rootIds) {
        await visit(prepared.document, nestedSnapshot, rootId, address, [...ancestorKeys, prepared.key])
      }
      return
    }
    if (!getComposeHierarchy(entity)) return
    for (const childId of resolveComposeRenderedChildIds(document, entityId)) {
      await visit(document, snapshot, childId, prefix, ancestorKeys)
    }
  }

  await visit(input.document, input.snapshot, input.rootId, '', [])
  return solved
}
