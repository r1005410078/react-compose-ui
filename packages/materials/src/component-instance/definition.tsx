import type {
  ComposeEntityPreset,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import {
  COMPOSE_COMPONENT_MEDIA_TYPE,
  COMPOSE_DEFAULT_FRAME_SIZE,
  getComposeFrame,
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
      // 线框三面不同明度：页面实例引用，与库内实心主组件区分。
      icon: (
        <svg
          aria-hidden="true"
          fill="none"
          height="18"
          viewBox="0 0 24 24"
          width="18"
        >
          <path d="M12 3.2 19.6 7.4 12 11.6 4.4 7.4Z" stroke="#a8c4e8" strokeLinejoin="round" strokeWidth="1.25" />
          <path d="M4.4 7.4 12 11.6 12 20.2 4.4 16Z" stroke="#6a8ab0" strokeLinejoin="round" strokeWidth="1.25" />
          <path d="M19.6 7.4 12 11.6 12 20.2 19.6 16Z" stroke="#4a6588" strokeLinejoin="round" strokeWidth="1.25" />
          <path d="M12 11.6V20.2" stroke="#8aa6c8" strokeOpacity="0.7" strokeWidth="1" />
        </svg>
      ),
      paletteHidden: true,
      createComponents: () => ({
        ...rendererPresetComponents({
          type: 'component-instance',
          props: { reference: null, resolvedSnapshot: null, instanceOverrides: { properties: {}, operations: [] } },
          size: { width: 1, height: 1 },
          appearance: TRANSPARENT_APPEARANCE,
        }),
        // 页面实例最外层需可 free 缩放以便组合；与根约束解耦。
        GeometryConstraints: { movable: true, resize: 'free', rotatable: true },
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
          // 实例尺寸跟随组件根 Frame。
          const rootId = snapshot.document.rootIds[0]
          const size = (rootId ? getComposeFrame(snapshot.document.entities[rootId]) : null)?.size
            ?? COMPOSE_DEFAULT_FRAME_SIZE
          const rendererProps = {
            reference,
            resolvedSnapshot: snapshot,
            instanceOverrides: { properties: {}, operations: [] },
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
              GeometryConstraints: { movable: true, resize: 'free', rotatable: true },
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
