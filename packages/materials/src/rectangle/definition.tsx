import type {
  ComposeEntityPreset,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import type { ComposeBasicMaterialOptions } from '../types'
import { ComposeRectangleMaterialIcon } from '../material-icons'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import { DEFAULT_RECTANGLE_APPEARANCE, DEFAULT_RECTANGLE_SIZE } from './defaults'
import { RectangleRenderer } from './renderer'

/**
 * 创建 Panel Renderer 与 Entity Preset。
 *
 * @remarks
 * **它已从物料面板退役**（`paletteHidden`），新建入口归 `rect` 曲线 Preset：那一个默认也带
 * 填充，面向用户同样是「一个矩形」，而且还能双击改形状、拖圆角手柄。两个长得一样的条目是
 * 用户自己发现不了、只能靠试出来的一类缺陷。
 *
 * 它剩下的独占能力只有渐变/图片背景（曲线只画纯色）与 `Appearance` 边框，而那两样**容器**
 * 都有且还能装子级——Panel 本来就是容器去掉子级的版本。
 *
 * Renderer 与 Preset 的**协议 id 照旧保留**：既有文档里的每一个盒都靠 `rectangle` 找到
 * 渲染器，删掉等于让它们全部落到「未知 Renderer」的占位上。退役的是**新建入口**，不是
 * 渲染能力。
 *
 * @internal
 */
export function createRectangleMaterial(
  options: ComposeBasicMaterialOptions = {},
): { renderer: ComposeRendererDefinition; preset: ComposeEntityPreset } {
  const size = options.defaultSize ?? DEFAULT_RECTANGLE_SIZE
  const props = mergeJson({}, options.defaultProps)
  const appearance = mergeAppearance(
    DEFAULT_RECTANGLE_APPEARANCE,
    options.defaultAppearance,
  )
  return {
    renderer: {
      type: 'rectangle',
      label: options.label ?? 'Panel',
      renderer: RectangleRenderer,
    },
    preset: {
      id: 'rectangle',
      label: options.label ?? 'Panel',
      defaultName: options.name ?? 'Panel',
      icon: <ComposeRectangleMaterialIcon />,
      paletteHidden: true,
      createComponents: () => rendererPresetComponents({
        type: 'rectangle',
        props,
        size,
        appearance,
      }),
    },
  }
}

const rectangle = createRectangleMaterial()
/** 默认 Rectangle Renderer。 @public */
export const DEFAULT_COMPOSE_RECTANGLE_RENDERER = rectangle.renderer
/** 默认 Rectangle Entity Preset。 @public */
export const DEFAULT_COMPOSE_RECTANGLE_PRESET = rectangle.preset
