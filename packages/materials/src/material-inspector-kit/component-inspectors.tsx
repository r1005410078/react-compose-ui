import { useMemo } from 'react'
import * as v from 'valibot'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeAppearance,
  getComposeClip,
  getComposeHierarchy,
  getComposeLayout,
  getComposeRenderer,
  getComposeSpatialTransform,
  resolveComposeAppearance,
  type ComposeAppearance,
  type ComposeColor,
  type ComposeEntity,
  type ComposeGeometryConstraints,
  type ComposeLayoutItem,
  type ComposePaint,
  type ComposeTransform,
  type EditorCommand,
  type JsonObject,
  type JsonValue,
} from '@compose-ui/core'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type { ComponentType } from 'react'
import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
import type { InspectorIdFactory } from './renderer-inspectors'

function command(
  idFactory: InspectorIdFactory,
  entity: ComposeEntity,
  type: string,
  payload: JsonObject,
  label: string,
): EditorCommand {
  return {
    id: idFactory(),
    type,
    payload,
    meta: {
      label,
      source: 'inspector',
      targetIds: [entity.id],
      mergeKey: `inspector:${entity.id}:${type}`,
    },
  }
}

function useZh(): boolean {
  return (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
}

/** 创建 Transform Component Inspector。 @internal */
export function createTransformInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function TransformInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const schema = useMemo(() => v.object({
      rotation: v.pipe(
        v.number(),
        v.title(zh ? '旋转' : 'Rotation'),
        v.metadata({ propertyPanel: { editor: 'angle' } }),
      ),
    }), [zh])
    return (
      <ComposePropertyPanel
        aria-label={zh ? '变换属性' : 'Transform properties'}
        readOnly={readOnly}
        schema={schema}
        value={value as ComposeTransform}
        onValueChange={(next) => {
          const current = getComposeSpatialTransform(entity)
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.setTransform,
            {
              operation: 'set',
              updates: [{
                entityId: entity.id,
                transform: { ...current, rotation: next.rotation },
              }] as unknown as JsonValue,
            },
            zh ? `修改 ${entity.name} 变换` : `Update ${entity.name} transform`,
          ))
        }}
      />
    )
  }
}

/** 创建 LayoutItem Component Inspector。 @internal */
export function createLayoutItemInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function LayoutItemInspector({
    document,
    entity,
    dispatch,
    layoutSnapshot,
    readOnly,
    value,
  }) {
    const zh = useZh()
    const item = value as ComposeLayoutItem
    const parent = document && Object.values(document.entities).find((candidate) =>
      getComposeHierarchy(candidate)?.childIds.includes(entity.id))
    const fillAllowed = item.positioning === 'flow' && Boolean(parent && getComposeLayout(parent))
    const hierarchy = getComposeHierarchy(entity)
    const hugAllowed = hierarchy ? Boolean(getComposeLayout(entity)) : Boolean(getComposeRenderer(entity))
    const schema = useMemo(() => {
      const sizingModes = fillAllowed
        ? (hugAllowed ? ['fixed', 'fill', 'hug'] as const : ['fixed', 'fill'] as const)
        : (hugAllowed ? ['fixed', 'hug'] as const : ['fixed'] as const)
      return v.object({
      positioning: v.pipe(
        v.picklist(['flow', 'absolute']),
        v.title(zh ? '定位' : 'Positioning'),
      ),
      offset: v.pipe(
        v.object({ x: v.number(), y: v.number() }),
        v.title(zh ? '偏移' : 'Offset'),
        v.metadata({ propertyPanel: { editor: 'vector2' } }),
      ),
      widthMode: v.pipe(
        v.picklist(sizingModes),
        v.title(zh ? '宽度模式' : 'Width mode'),
      ),
      widthValue: v.pipe(v.number(), v.minValue(0), v.title(zh ? '宽度' : 'Width')),
      heightMode: v.pipe(
        v.picklist(sizingModes),
        v.title(zh ? '高度模式' : 'Height mode'),
      ),
      heightValue: v.pipe(v.number(), v.minValue(0), v.title(zh ? '高度' : 'Height')),
      computedWidth: v.pipe(
        v.number(),
        v.title(zh ? '计算宽度' : 'Computed width'),
        v.metadata({ propertyPanel: { readOnly: true } }),
      ),
      computedHeight: v.pipe(
        v.number(),
        v.title(zh ? '计算高度' : 'Computed height'),
        v.metadata({ propertyPanel: { readOnly: true } }),
      ),
      marginTop: v.pipe(v.number(), v.title(zh ? '上外边距' : 'Margin top')),
      marginRight: v.pipe(v.number(), v.title(zh ? '右外边距' : 'Margin right')),
      marginBottom: v.pipe(v.number(), v.title(zh ? '下外边距' : 'Margin bottom')),
      marginLeft: v.pipe(v.number(), v.title(zh ? '左外边距' : 'Margin left')),
      alignSelf: v.pipe(
        v.picklist(['auto', 'flex-start', 'center', 'flex-end', 'stretch', 'baseline']),
        v.title(zh ? '自身对齐' : 'Align self'),
      ),
      })
    }, [fillAllowed, hugAllowed, zh])
    return (
      <ComposePropertyPanel
        aria-label={zh ? '布局项属性' : 'Layout item properties'}
        readOnly={readOnly}
        schema={schema}
        value={{
          positioning: item.positioning,
          offset: item.offset,
          widthMode: item.width.mode,
          widthValue: item.width.value,
          heightMode: item.height.mode,
          heightValue: item.height.value,
          computedWidth: layoutSnapshot?.boxes[entity.id]?.width ?? item.width.value,
          computedHeight: layoutSnapshot?.boxes[entity.id]?.height ?? item.height.value,
          marginTop: item.margin.top,
          marginRight: item.margin.right,
          marginBottom: item.margin.bottom,
          marginLeft: item.margin.left,
          alignSelf: item.alignSelf,
        }}
        onValueChange={(next) => {
          if (next.positioning === 'flow' && (!parent || !getComposeLayout(parent))) return
          if (!hugAllowed && (next.widthMode === 'hug' || next.heightMode === 'hug')) return
          const bakedBox = item.positioning === 'flow' && next.positioning === 'absolute'
            ? layoutSnapshot?.boxes[entity.id]
            : undefined
          const parentBorder = parent ? resolveComposeAppearance(parent).borderWidth : 0
          const widthMode = next.positioning === 'absolute' && next.widthMode === 'fill'
            ? 'fixed'
            : next.widthMode
          const heightMode = next.positioning === 'absolute' && next.heightMode === 'fill'
            ? 'fixed'
            : next.heightMode
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.updateComponent,
            {
              entityId: entity.id,
              key: 'LayoutItem',
              value: {
                ...item,
                positioning: next.positioning,
                offset: bakedBox
                  ? { x: bakedBox.x - parentBorder, y: bakedBox.y - parentBorder }
                  : next.offset,
                width: {
                  ...item.width,
                  mode: widthMode,
                  value: bakedBox && item.width.mode === 'fill'
                    ? bakedBox.width
                    : next.widthValue,
                },
                height: {
                  ...item.height,
                  mode: heightMode,
                  value: bakedBox && item.height.mode === 'fill'
                    ? bakedBox.height
                    : next.heightValue,
                },
                margin: {
                  top: next.marginTop,
                  right: next.marginRight,
                  bottom: next.marginBottom,
                  left: next.marginLeft,
                },
                alignSelf: next.alignSelf,
              },
            },
            zh ? `修改 ${entity.name} 布局项` : `Update ${entity.name} layout item`,
          ))
        }}
      />
    )
  }
}

/** 创建 Visibility Component Inspector。 @internal */
export function createVisibilityInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function VisibilityInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const schema = useMemo(() => v.object({
      visible: v.pipe(v.boolean(), v.title(zh ? '可见' : 'Visible')),
    }), [zh])
    return (
      <ComposePropertyPanel
        aria-label={zh ? '状态属性' : 'State properties'}
        readOnly={readOnly}
        schema={schema}
        value={{ visible: value.visible === true }}
        onValueChange={(next) => {
          if (readOnly) return
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.setVisibility,
            { entityIds: [entity.id], visible: next.visible },
            next.visible
              ? (zh ? `显示 ${entity.name}` : `Show ${entity.name}`)
              : (zh ? `隐藏 ${entity.name}` : `Hide ${entity.name}`),
          ))
        }}
      />
    )
  }
}

/** 创建 Lock Component Inspector；锁定 Entity 时仍可解除锁定。 @internal */
export function createLockInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function LockInspector({ entity, dispatch, value }) {
    const zh = useZh()
    const schema = useMemo(() => v.object({
      locked: v.pipe(v.boolean(), v.title(zh ? '锁定' : 'Locked')),
    }), [zh])
    return (
      <ComposePropertyPanel
        aria-label={zh ? '锁定属性' : 'Lock properties'}
        schema={schema}
        value={{ locked: value.locked === true }}
        onValueChange={(next) => dispatch(command(
          idFactory,
          entity,
          BUILTIN_COMMAND_TYPES.setLock,
          { entityIds: [entity.id], locked: next.locked },
          next.locked
            ? (zh ? `锁定 ${entity.name}` : `Lock ${entity.name}`)
            : (zh ? `解锁 ${entity.name}` : `Unlock ${entity.name}`),
        ))}
      />
    )
  }
}

/** 创建 Appearance Component Inspector。 @internal */
export function createAppearanceInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function AppearanceInspector({ entity, dispatch, paintEditPort, readOnly }) {
    const zh = useZh()
    const schema = useMemo(() => v.object({
      backgroundPaint: v.pipe(
        v.unknown(),
        v.title(zh ? '背景填充' : 'Background fill'),
        v.metadata({ propertyPanel: { editor: 'paint' } }),
      ),
      borderColor: v.pipe(
        v.string(),
        v.title(zh ? '边框颜色' : 'Border color'),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
      borderWidth: v.pipe(
        v.number(),
        v.minValue(0),
        v.title(zh ? '边框宽度' : 'Border width'),
        v.metadata({ propertyPanel: { editor: 'stroke-width' } }),
      ),
      borderRadius: v.pipe(
        v.number(),
        v.minValue(0),
        v.title(zh ? '圆角' : 'Corner radius'),
        v.metadata({ propertyPanel: { editor: 'corner-radius' } }),
      ),
      opacity: v.pipe(
        v.number(),
        v.minValue(0),
        v.maxValue(1),
        v.title(zh ? '透明度' : 'Opacity'),
        v.metadata({ propertyPanel: { editor: 'opacity' } }),
      ),
    }), [zh])
    const appearance = resolveComposeAppearance(entity)
    return (
      <ComposePropertyPanel
        aria-label={zh ? '外观属性' : 'Appearance properties'}
        readOnly={readOnly}
        colorEditor={{
          onEyedropperFallback: () => paintEditPort?.sample({
            entityId: entity.id,
            field: 'borderColor',
          }),
        }}
        paintEditor={{
          onOpenChange: (open) => {
            if (open) paintEditPort?.open({ entityId: entity.id })
            else paintEditPort?.close()
          },
          onEyedropperFallback: () => paintEditPort?.sample({
            entityId: entity.id,
            field: 'backgroundPaint',
          }),
        }}
        schema={schema}
        value={{
          backgroundPaint: appearance.backgroundPaint,
          borderColor: appearance.borderColor,
          borderWidth: appearance.borderWidth,
          borderRadius: appearance.borderRadius,
          opacity: appearance.opacity,
        }}
        onValueChange={(next) => {
          // shadow 等未进入本 schema 的字段必须原样保留，setAppearance 是整体替换语义。
          const current = getComposeAppearance(entity)
          const appearanceValue: ComposeAppearance = {
            ...current,
            ...next,
            backgroundPaint: next.backgroundPaint as ComposePaint,
            borderColor: next.borderColor as ComposeColor,
          }
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.setAppearance,
            { entityId: entity.id, appearance: appearanceValue },
            zh ? `修改 ${entity.name} 外观` : `Update ${entity.name} appearance`,
          ))
        }}
      />
    )
  }
}

/** 创建 Hierarchy（容器）Component Inspector；同时呈现 Clip 开关。 @internal */
export function createHierarchyInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function HierarchyInspector({ entity, dispatch, readOnly }) {
    const zh = useZh()
    const hierarchy = getComposeHierarchy(entity)
    const clip = getComposeClip(entity)
    const childCountSchema = useMemo(() => v.object({
      childCount: v.pipe(
        v.number(),
        v.title(zh ? '子项数量' : 'Child count'),
        v.metadata({ propertyPanel: { readOnly: true } }),
      ),
    }), [zh])
    const schema = useMemo(() => v.object({
      childCount: v.pipe(
        v.number(),
        v.title(zh ? '子项数量' : 'Child count'),
        v.metadata({ propertyPanel: { readOnly: true } }),
      ),
      clip: v.pipe(v.boolean(), v.title(zh ? '裁剪内容' : 'Clip content')),
    }), [zh])
    if (!hierarchy) return null
    if (!clip) {
      return (
        <ComposePropertyPanel
          aria-label={zh ? '容器属性' : 'Container properties'}
          readOnly
          schema={childCountSchema}
          value={{ childCount: hierarchy.childIds.length }}
        />
      )
    }
    return (
      <ComposePropertyPanel
        aria-label={zh ? '容器属性' : 'Container properties'}
        readOnly={readOnly}
        schema={schema}
        value={{
          childCount: hierarchy.childIds.length,
          clip: clip.enabled,
        }}
        onValueChange={(next) => {
          if (readOnly) return
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.setClip,
            { entityIds: [entity.id], enabled: next.clip },
            zh ? `修改 ${entity.name} 裁剪` : `Update ${entity.name} clipping`,
          ))
        }}
      />
    )
  }
}

/** 创建 GeometryConstraints Component Inspector。 @internal */
export function createConstraintsInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function ConstraintsInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const constraints = value as ComposeGeometryConstraints
    const schema = useMemo(() => v.object({
      movable: v.pipe(v.boolean(), v.title(zh ? '允许移动' : 'Movable')),
      resize: v.pipe(
        v.picklist(['free', 'preserve-aspect', 'horizontal', 'vertical', 'none']),
        v.title(zh ? 'Resize 模式' : 'Resize mode'),
        v.metadata({ propertyPanel: { optionLabels: zh
          ? {
              free: '自由',
              'preserve-aspect': '保持比例',
              horizontal: '仅水平',
              vertical: '仅垂直',
              none: '禁止',
            }
          : {
              free: 'Free',
              'preserve-aspect': 'Preserve aspect',
              horizontal: 'Horizontal only',
              vertical: 'Vertical only',
              none: 'Disabled',
            } } }),
      ),
      rotatable: v.pipe(v.boolean(), v.title(zh ? '允许旋转' : 'Rotatable')),
    }), [zh])
    return (
      <ComposePropertyPanel
        aria-label={zh ? '几何限制属性' : 'Geometry constraints'}
        readOnly={readOnly}
        schema={schema}
        value={{
          movable: constraints.movable,
          resize: constraints.resize,
          rotatable: constraints.rotatable,
        }}
        onValueChange={(next) => {
          const nextValue: ComposeGeometryConstraints = { ...constraints, ...next }
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.updateComponent,
            { entityId: entity.id, key: 'GeometryConstraints', value: nextValue },
            zh ? `修改 ${entity.name} 几何限制` : `Update ${entity.name} constraints`,
          ))
        }}
      />
    )
  }
}
