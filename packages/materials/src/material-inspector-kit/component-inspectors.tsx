import { useMemo } from 'react'
import * as v from 'valibot'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeAppearance,
  getComposeClip,
  getComposeHierarchy,
  resolveComposeAppearance,
  type ComposeAppearance,
  type ComposeEntity,
  type ComposeTransform,
  type ComposeTransformConstraints,
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
      position: v.pipe(
        v.object({ x: v.number(), y: v.number() }),
        v.title(zh ? '位置' : 'Position'),
        v.metadata({ propertyPanel: { editor: 'vector2' } }),
      ),
      size: v.pipe(
        v.object({
          width: v.pipe(v.number(), v.minValue(0.000_001)),
          height: v.pipe(v.number(), v.minValue(0.000_001)),
        }),
        v.title(zh ? '尺寸' : 'Size'),
        v.metadata({ propertyPanel: { editor: 'size' } }),
      ),
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
        onValueChange={(next) => dispatch(command(
          idFactory,
          entity,
          BUILTIN_COMMAND_TYPES.setTransform,
          {
            operation: 'set',
            updates: [{ entityId: entity.id, transform: next }] as unknown as JsonValue,
          },
          zh ? `修改 ${entity.name} 变换` : `Update ${entity.name} transform`,
        ))}
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
  return function AppearanceInspector({ entity, dispatch, readOnly }) {
    const zh = useZh()
    const schema = useMemo(() => v.object({
      backgroundColor: v.pipe(
        v.string(),
        v.title(zh ? '背景颜色' : 'Background'),
        v.metadata({ propertyPanel: { editor: 'color' } }),
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
        schema={schema}
        value={{
          backgroundColor: appearance.backgroundColor,
          borderColor: appearance.borderColor,
          borderWidth: appearance.borderWidth,
          borderRadius: appearance.borderRadius,
          opacity: appearance.opacity,
        }}
        onValueChange={(next) => {
          // shadow 等未进入本 schema 的字段必须原样保留，setAppearance 是整体替换语义。
          const current = getComposeAppearance(entity)
          const appearanceValue: ComposeAppearance = { ...current, ...next }
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

/** 创建 TransformConstraints Component Inspector。 @internal */
export function createConstraintsInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function ConstraintsInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const constraints = value as ComposeTransformConstraints
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
      minSize: v.pipe(
        v.object({
          width: v.pipe(v.number(), v.minValue(0.000_001)),
          height: v.pipe(v.number(), v.minValue(0.000_001)),
        }),
        v.title(zh ? '最小尺寸' : 'Minimum size'),
        v.metadata({ propertyPanel: { editor: 'size' } }),
      ),
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
          minSize: constraints.minSize,
        }}
        onValueChange={(next) => {
          // maxSize 不在本 schema 中，整体更新时必须保留原值。
          const nextValue: ComposeTransformConstraints = { ...constraints, ...next }
          dispatch(command(
            idFactory,
            entity,
            BUILTIN_COMMAND_TYPES.updateComponent,
            { entityId: entity.id, key: 'TransformConstraints', value: nextValue },
            zh ? `修改 ${entity.name} 几何限制` : `Update ${entity.name} constraints`,
          ))
        }}
      />
    )
  }
}
