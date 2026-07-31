import type {
  ComposeCapabilityDefinition,
  ComposeComponentDefinition,
} from '@compose-ui/component-registry'
import {
  createDefaultComposeFlexLayout,
  isValidComposeLayout,
} from '@compose-ui/core'
import {
  createLayoutInspector,
  createLayoutInspectorHeaderActions,
} from './flex-layout'
import {
  createAppearanceInspector,
  createConstraintsInspector,
  createHierarchyInspector,
  createLockInspector,
  createTransformInspector,
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
      createDefault: () => ({
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        rotation: 0,
      }),
      inspector: createTransformInspector(idFactory),
    },
    {
      key: 'Visibility',
      label: '可见性',
      order: 20,
      createDefault: () => ({ visible: true }),
      inspector: createVisibilityInspector(idFactory),
    },
    {
      key: 'Lock',
      label: '锁定',
      order: 30,
      createDefault: () => ({ locked: false }),
      inspector: createLockInspector(idFactory),
    },
    {
      key: 'Appearance',
      label: '外观',
      order: 40,
      createDefault: () => ({
        backgroundPaint: { kind: 'solid', color: 'transparent' },
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        opacity: 1,
        shadow: null,
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
      inspector: createLayoutInspector(idFactory),
      inspectorHeaderActions: createLayoutInspectorHeaderActions(idFactory),
    },
    {
      key: 'Clip',
      label: '裁剪',
      order: 60,
      createDefault: () => ({ enabled: true }),
    },
    {
      key: 'TransformConstraints',
      label: '几何限制',
      order: 70,
      createDefault: () => ({
        movable: true,
        resize: 'free',
        rotatable: true,
        minSize: { width: 1, height: 1 },
        maxSize: null,
      }),
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
        Layout: createDefaultComposeFlexLayout(),
        Clip: { enabled: true },
      }),
    },
    {
      id: 'geometry-constraints',
      label: '几何限制',
      description: '限制移动、旋转与 Resize 行为',
      createComponents: () => ({
        TransformConstraints: {
          movable: true,
          resize: 'free',
          rotatable: true,
          minSize: { width: 1, height: 1 },
          maxSize: null,
        },
      }),
    },
  ])
