import type {
  ComposeEntityPreset,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import * as v from 'valibot'
import {
  getComposeFrame,
  isComposePageMediaType,
  parseComposePageFile,
  resolveComposePageActiveFrameId,
} from '@compose-ui/core'
import type { ComposeBasicMaterialOptions } from '../types'
import { ComposePageSlotMaterialIcon } from '../material-icons'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import { DEFAULT_PAGE_SLOT_APPEARANCE, DEFAULT_PAGE_SLOT_SIZE } from './defaults'
import {
  createDefaultInspectorId,
  createPageSlotRendererInspector,
} from '../material-inspector-kit/renderer-inspectors'
import { composeNodePropertySchema } from '../material-inspector-kit/node'
import { PageSlotRenderer } from './renderer'
import { PAGE_SLOT_RENDERER_MEASUREMENT } from './measurement'

const PAGE_PROP_SCHEMA = composeNodePropertySchema()

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
      propContracts: [{
        name: 'page',
        kind: 'value',
        label: 'Page',
        category: 'page',
        validate: (value) => v.safeParse(PAGE_PROP_SCHEMA, value).success
          ? true
          : 'Page 与 Page Slot Prop Contract 不兼容',
      }],
      propCategories: [{ id: 'page', label: '页面' }],
      inspectorPropNames: ['page'],
      inspector: createPageSlotRendererInspector(idFactory),
      measurement: PAGE_SLOT_RENDERER_MEASUREMENT,
    },
    preset: {
      id: 'page-slot',
      label: options.label ?? 'Page Slot',
      defaultName: options.name ?? 'Page Slot',
      icon: <ComposePageSlotMaterialIcon />,
      // Page Slot 的实际入口是从资源面板把页面文件拖入画布——那条路径会顺带带上页面引用
      // 与目标 output 尺寸。Palette 里空手创建出的是一个未指向任何页面的占位，价值有限。
      paletteHidden: true,
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
          // 能读出被引用页面激活场景的尺寸时按它建槽位，否则用默认尺寸。
          const parsed = parseComposePageFile(await resolved.blob.text())
          const frameId = parsed.ok
            ? resolveComposePageActiveFrameId(parsed.page)
            : undefined
          const frame = parsed.ok && frameId
            ? getComposeFrame(parsed.page.document.entities[frameId])
            : null
          const measured = frame
            ? { width: frame.size.width, height: frame.size.height }
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
