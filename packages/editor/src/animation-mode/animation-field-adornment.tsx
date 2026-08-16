import type { ComposeDocument, JsonValue } from '@compose-ui/core'
import { getComposeAppearance, getComposeLayoutItem, getComposeTransform } from '@compose-ui/core'
import type { ComposeAnimationValueKind } from '@compose-ui/animation'
import type {
  ComposePropertyPanelFieldAdornmentContext,
  ComposePropertyPanelFieldAdornmentRenderer,
} from '@compose-ui/property-panel'
import { AnimationKeyButton } from './animation-key-button'
import type { AnimationKeyButtonMessages } from './animation-key-button'
import type { AnimationModeSession } from './use-animation-mode'

/** 单个可打点字段的文档映射。 */
interface AnimatableFieldTarget {
  readonly path: readonly (string | number)[]
  readonly valueKind: ComposeAnimationValueKind
  /** 从基础文档读出该属性的当前值；不可用（如非纯色 Paint）时返回 undefined。 */
  readonly readValue: (document: ComposeDocument, entityId: string) => JsonValue | undefined
}

/**
 * Inspector 字段相对路径 → 可动画文档属性的白名单。
 *
 * @remarks
 * key 是 Inspector Schema 中的字段名（各分组间不重名），不是 Entity 内路径——
 * Inspector 的几何分组把 `Transform.rotation` 与 `LayoutItem.offset` 拼在同一个
 * Schema 里。白名单之外的字段不渲染菱形。
 */
const ANIMATABLE_FIELDS: Readonly<Record<string, readonly AnimatableFieldTarget[]>> = {
  position: [{
    path: ['LayoutItem', 'offset'],
    valueKind: 'vector2',
    readValue: (document, entityId) => {
      const entity = document.entities[entityId]
      if (!entity) return undefined
      const offset = getComposeLayoutItem(entity).offset
      return { x: offset.x, y: offset.y }
    },
  }],
  rotation: [{
    path: ['Transform', 'rotation'],
    valueKind: 'number',
    readValue: (document, entityId) => {
      const entity = document.entities[entityId]
      return entity ? getComposeTransform(entity).rotation : undefined
    },
  }],
  // 尺寸是一个字段两条轨道：菱形以宽度轨道为代表显示状态，点击同时作用于宽高。
  size: [
    {
      path: ['LayoutItem', 'width', 'value'],
      valueKind: 'number',
      readValue: (document, entityId) => {
        const entity = document.entities[entityId]
        return entity ? getComposeLayoutItem(entity).width.value : undefined
      },
    },
    {
      path: ['LayoutItem', 'height', 'value'],
      valueKind: 'number',
      readValue: (document, entityId) => {
        const entity = document.entities[entityId]
        return entity ? getComposeLayoutItem(entity).height.value : undefined
      },
    },
  ],
  opacity: [{
    path: ['Appearance', 'opacity'],
    valueKind: 'number',
    readValue: (document, entityId) => {
      const entity = document.entities[entityId]
      return entity ? getComposeAppearance(entity)?.opacity ?? 1 : undefined
    },
  }],
  backgroundPaint: [{
    path: ['Appearance', 'backgroundPaint', 'color'],
    valueKind: 'color',
    readValue: (document, entityId) => {
      const entity = document.entities[entityId]
      const paint = entity ? getComposeAppearance(entity)?.backgroundPaint : undefined
      // 只有纯色 Paint 可动画；渐变与图片没有单一颜色通道。
      return paint && paint.kind === 'solid' ? paint.color : undefined
    },
  }],
}

/** 创建动画模式下注入属性面板的字段装饰闭包。 */
export function createAnimationFieldAdornment(options: {
  readonly session: AnimationModeSession
  readonly document: ComposeDocument
  readonly entityId: string
  readonly messages: AnimationKeyButtonMessages
}): ComposePropertyPanelFieldAdornmentRenderer {
  const { document, entityId, messages, session } = options
  return function renderAnimationFieldAdornment(
    context: ComposePropertyPanelFieldAdornmentContext,
  ) {
    if (context.path.length !== 1) return null
    const targets = ANIMATABLE_FIELDS[String(context.path[0])]
    if (!targets) return null
    const primary = targets[0]!
    const primaryValue = primary.readValue(document, entityId)
    // 代表轨道决定视觉状态；值读不出来（非纯色 Paint 等）时按不可动画禁用。
    const state = primaryValue === undefined
      ? 'unavailable'
      : session.keyStateFor(entityId, primary.path)
    return (
      <AnimationKeyButton
        label={context.label}
        messages={messages}
        state={state}
        onToggle={() => {
          targets.forEach((target) => {
            const value = target.readValue(document, entityId)
            if (value !== undefined) {
              session.toggleKey(entityId, target.path, target.valueKind, value)
            }
          })
        }}
      />
    )
  }
}
