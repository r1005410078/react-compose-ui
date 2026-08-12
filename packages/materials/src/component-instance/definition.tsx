import type {
  ComposeEntityPreset,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import {
  COMPOSE_COMPONENT_MEDIA_TYPE,
  createComposeResolvedComponentSnapshot,
  isComposeComponentMediaType,
  parseComposeComponentAsset,
  type ComposeComponentReference,
  type ComposeAppearance,
  type JsonObject,
} from '@compose-ui/core'
import { rendererPresetComponents } from '../material-preset'
import { ComponentInstanceRenderer } from './renderer'
import { COMPONENT_INSTANCE_RENDERER_MEASUREMENT } from './measurement'

/** component-instance 使用的透明外观。 */
const TRANSPARENT_APPEARANCE: ComposeAppearance = {
  backgroundPaint: { kind: 'solid' as const, color: 'transparent' },
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
}

/** 创建隐藏的关联组件实例 Renderer 与 Preset。 @internal */
export function createComponentInstanceMaterial(): {
  renderer: ComposeRendererDefinition
  preset: ComposeEntityPreset
} {
  return {
    renderer: {
      type: 'component-instance',
      label: 'Component Instance',
      renderer: ComponentInstanceRenderer,
      measurement: COMPONENT_INSTANCE_RENDERER_MEASUREMENT,
    },
    preset: {
      id: 'component-instance',
      label: 'Component',
      defaultName: 'Component',
      icon: (
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="m10 2 6.5 3.7v8.6L10 18l-6.5-3.7V5.7L10 2Z" fill="none" stroke="currentColor" />
          <path d="m3.5 5.7 6.5 3.8 6.5-3.8M10 9.5V18" fill="none" stroke="currentColor" />
          <path d="M6.5 4.1 13 7.9" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
      paletteHidden: true,
      createComponents: () => ({
        ...rendererPresetComponents({
          type: 'component-instance',
          props: { reference: null, resolvedSnapshot: null, propertyOverrides: {} },
          size: { width: 1, height: 1 },
          appearance: TRANSPARENT_APPEARANCE,
        }),
        GeometryConstraints: { movable: true, resize: 'none', rotatable: true },
      }),
      assetDrop: {
        accepts: ({ mediaType }) => isComposeComponentMediaType(mediaType),
        async createSeed({ name, reference: assetReference, resolved }) {
          if (resolved.mediaType !== COMPOSE_COMPONENT_MEDIA_TYPE) {
            throw new Error('资源不是 Compose Component Asset')
          }
          const parsed = parseComposeComponentAsset(await resolved.blob.text())
          if (!parsed.ok) {
            throw new Error(parsed.issues.map(({ message }) => message).join('；'))
          }
          const reference: ComposeComponentReference = {
            kind: 'component',
            providerId: assetReference.providerId,
            assetKey: assetReference.assetKey,
            scope: assetReference.scope,
          }
          const snapshot = createComposeResolvedComponentSnapshot(
            parsed.asset,
            reference,
            resolved.revision,
          )
          const size = snapshot.document.output
          const rendererProps = {
            reference,
            resolvedSnapshot: snapshot,
            propertyOverrides: {},
          } as unknown as JsonObject
          const components = rendererPresetComponents({
            type: 'component-instance',
            props: rendererProps,
            size,
            appearance: TRANSPARENT_APPEARANCE,
          })
          return {
            name: parsed.asset.name || name,
            components: {
              ...components,
              LayoutItem: {
                ...components.LayoutItem,
                width: { ...components.LayoutItem.width, mode: 'hug' },
                height: { ...components.LayoutItem.height, mode: 'hug' },
              },
              GeometryConstraints: { movable: true, resize: 'none', rotatable: true },
            },
          }
        },
      },
    },
  }
}

const componentInstance = createComponentInstanceMaterial()

/** 默认关联组件实例 Renderer。 @public */
export const DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER = componentInstance.renderer

/** 默认关联组件实例 Preset。 @public */
export const DEFAULT_COMPOSE_COMPONENT_INSTANCE_PRESET = componentInstance.preset
