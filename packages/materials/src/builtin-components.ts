import type {
  ComposeCapabilityDefinition,
  ComposeComponentDefinition,
} from '@compose-ui/component-registry'
import {
  DEFAULT_COMPOSE_APPEARANCE,
  createDefaultComposeFlexLayout,
  createDefaultComposeLayoutItem,
  isValidComposeLayout,
  isValidComposeLayoutItem,
  isValidComposeGeometryConstraints,
} from '@compose-ui/core'
import {
  DEFAULT_COMPOSE_CLIP,
  DEFAULT_COMPOSE_GEOMETRY_CONSTRAINTS,
  DEFAULT_COMPOSE_LOCK,
  DEFAULT_COMPOSE_TRANSFORM,
  DEFAULT_COMPOSE_VISIBILITY,
} from './builtin-component-defaults'
import {
  createLayoutInspector,
  createLayoutInspectorHeaderActions,
  createLayoutMissingInspectorActions,
  createLayoutMissingInspectorContent,
} from './flex-layout'
import {
  createAppearanceInspector,
  createConstraintsInspector,
  createHierarchyInspector,
  createLockInspector,
  createLayoutItemInspector,
  createVisibilityInspector,
} from './material-inspector-kit/component-inspectors'
import {
  createDefaultInspectorId,
  type InspectorIdFactory,
} from './material-inspector-kit/renderer-inspectors'

/**
 * 创建带 Inspector 的内建 ECS Component Registry 定义。
 *
 * @remarks
 * Editor 通过 Registry 的 `ComposeComponentDefinition.inspector` 协议聚合全部
 * Component 分组；内建 Component 的编辑 UI 与宿主扩展走同一条路径。Layout 拥有独立
 * Flex Inspector；Clip 的开关由 Hierarchy（容器）Inspector 呈现，因此 Clip 自身不携带 Inspector。
 *
 * @param idFactory - Inspector 派发命令使用的稳定 ID factory。
 * @public
 */
export function createComposeBuiltinComponentDefinitions(
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): readonly ComposeComponentDefinition[] {
  return Object.freeze([
    {
      key: 'Composition',
      label: '组合',
      order: -100,
      hidden: true,
      createDefault: () => ({
        presetId: null,
        baseComponentKeys: [],
        capabilityIds: [],
      }),
    },
    {
      key: 'Transform',
      label: '变换',
      order: 10,
      createDefault: () => ({ ...DEFAULT_COMPOSE_TRANSFORM }),
    },
    {
      key: 'LayoutItem',
      label: '布局项',
      order: 12,
      createDefault: createDefaultComposeLayoutItem,
      validate: isValidComposeLayoutItem,
      inspectorGroup: 'basic',
      inspector: createLayoutItemInspector(idFactory),
    },
    {
      key: 'Visibility',
      label: '可见性',
      order: 20,
      createDefault: () => ({ ...DEFAULT_COMPOSE_VISIBILITY }),
      inspector: createVisibilityInspector(idFactory),
    },
    {
      key: 'Lock',
      label: '锁定',
      order: 30,
      createDefault: () => ({ ...DEFAULT_COMPOSE_LOCK }),
      inspector: createLockInspector(idFactory),
    },
    {
      key: 'Appearance',
      label: '外观',
      order: 40,
      // backgroundPaint 是对象，必须一并复制，createDefault 不得返回共享引用。
      createDefault: () => ({
        ...DEFAULT_COMPOSE_APPEARANCE,
        backgroundPaint: { ...DEFAULT_COMPOSE_APPEARANCE.backgroundPaint },
      }),
      inspector: createAppearanceInspector(idFactory),
    },
    {
      key: 'Hierarchy',
      label: '容器',
      order: 50,
      createDefault: () => ({ childIds: [] }),
      inspector: createHierarchyInspector(idFactory),
    },
    {
      key: 'Layout',
      label: '布局',
      order: 15,
      createDefault: createDefaultComposeFlexLayout,
      validate: isValidComposeLayout,
      inspectorDefaultExpanded: true,
      inspector: createLayoutInspector(idFactory),
      inspectorHeaderActions: createLayoutInspectorHeaderActions(idFactory),
      missingInspector: {
        isVisible: (entity) => entity.components.Hierarchy !== undefined,
        actions: createLayoutMissingInspectorActions(idFactory),
        content: createLayoutMissingInspectorContent(idFactory),
      },
    },
    {
      key: 'Clip',
      label: '裁剪',
      order: 60,
      createDefault: () => ({ ...DEFAULT_COMPOSE_CLIP }),
    },
    {
      key: 'GeometryConstraints',
      label: '几何限制',
      order: 70,
      createDefault: () => ({ ...DEFAULT_COMPOSE_GEOMETRY_CONSTRAINTS }),
      validate: isValidComposeGeometryConstraints,
      inspector: createConstraintsInspector(idFactory),
    },
    {
      key: 'Renderer',
      label: '内容',
      order: 80,
      hidden: true,
      createDefault: () => ({ type: 'unknown', props: {} }),
    },
  ])
}

/** 使用默认命令 ID factory 的内建 ECS Component Registry 定义。 @public */
export const DEFAULT_COMPOSE_COMPONENT_DEFINITIONS: readonly ComposeComponentDefinition[] =
  createComposeBuiltinComponentDefinitions()

/** 内建可添加能力。 @public */
export const DEFAULT_COMPOSE_CAPABILITY_DEFINITIONS: readonly ComposeCapabilityDefinition[] =
  Object.freeze([
    {
      id: 'container',
      label: '容器',
      description: '允许当前组件容纳并裁剪子项',
      createComponents: () => ({
        Hierarchy: { childIds: [] },
        Clip: { enabled: true, horizontal: 'clip', vertical: 'clip' },
      }),
    },
    {
      id: 'geometry-constraints',
      label: '几何限制',
      description: '限制移动、旋转与 Resize 行为',
      createComponents: () => ({
        GeometryConstraints: {
          movable: true,
          resize: 'free',
          rotatable: true,
        },
      }),
    },
  ])
