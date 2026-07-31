import type {
  ComposeEntityPreset,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import { isComposePageMediaType, parseComposePageDocument } from '@compose-ui/core'
import type { ComposeBasicMaterialOptions } from '../types'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import { DEFAULT_PAGE_SLOT_APPEARANCE, DEFAULT_PAGE_SLOT_SIZE } from './defaults'
import {
  createDefaultInspectorId,
  createPageSlotRendererInspector,
} from '../material-inspector-kit/renderer-inspectors'
import { PageSlotRenderer } from './renderer'
import { PAGE_SLOT_RENDERER_MEASUREMENT } from './measurement'

/** 创建 Page Slot Renderer 与 Entity Preset。 @internal */
export function createPageSlotMaterial(
  options: ComposeBasicMaterialOptions = {},
  idFactory: () => string = createDefaultInspectorId,
): { renderer: ComposeRendererDefinition; preset: ComposeEntityPreset } {
  const size = options.defaultSize ?? DEFAULT_PAGE_SLOT_SIZE
  const props = mergeJson({ page: null }, options.defaultProps)
  const appearance = mergeAppearance(
    DEFAULT_PAGE_SLOT_APPEARANCE,
    options.defaultAppearance,
  )
  return {
    renderer: {
      type: 'page-slot',
      label: options.label ?? 'Page Slot',
      renderer: PageSlotRenderer,
      inspector: createPageSlotRendererInspector(idFactory),
      measurement: PAGE_SLOT_RENDERER_MEASUREMENT,
    },
    preset: {
      id: 'page-slot',
      label: options.label ?? 'Page Slot',
      defaultName: options.name ?? 'Page Slot',
      icon: <span aria-hidden="true">▤</span>,
      createComponents: () => rendererPresetComponents({
        type: 'page-slot',
        props,
        size,
        appearance,
      }),
      assetDrop: {
        // 只接受页面：身份判据是媒体类型，不是文件名。
        accepts: ({ mediaType }) => isComposePageMediaType(mediaType),
        async createSeed({ reference, resolved, name }) {
          // 能读出被引用页面的输出尺寸时按它建槽位，否则用默认尺寸。
          const parsed = parseComposePageDocument(await resolved.blob.text())
          const measured = parsed.ok
            ? { width: parsed.document.output.width, height: parsed.document.output.height }
            : size
          return {
            name,
            components: rendererPresetComponents({
              type: 'page-slot',
              props: {
                page: {
                  kind: 'page',
                  providerId: reference.providerId,
                  assetKey: reference.assetKey,
                  scope: reference.scope,
                },
              },
              size: measured,
              appearance,
            }),
          }
        },
      },
    },
  }
}

const pageSlot = createPageSlotMaterial()
/** 默认 Page Slot Renderer。 @public */
export const DEFAULT_COMPOSE_PAGE_SLOT_RENDERER = pageSlot.renderer
/** 默认 Page Slot Entity Preset。 @public */
export const DEFAULT_COMPOSE_PAGE_SLOT_PRESET = pageSlot.preset
