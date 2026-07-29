import type {
  ComposeCapabilityDefinition,
  ComposeComponentDefinition,
} from '@compose-ui/component-registry'

/** 内建 ECS Component Registry 定义。 @public */
export const DEFAULT_COMPOSE_COMPONENT_DEFINITIONS: readonly ComposeComponentDefinition[] =
  Object.freeze([
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
    },
    {
      key: 'Visibility',
      label: '可见性',
      order: 20,
      createDefault: () => ({ visible: true }),
    },
    {
      key: 'Lock',
      label: '锁定',
      order: 30,
      createDefault: () => ({ locked: false }),
    },
    {
      key: 'Appearance',
      label: '外观',
      order: 40,
      createDefault: () => ({
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        opacity: 1,
        shadow: null,
      }),
    },
    {
      key: 'Hierarchy',
      label: '容器',
      order: 50,
      createDefault: () => ({ childIds: [] }),
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
    },
    {
      key: 'Renderer',
      label: '内容',
      order: 80,
      hidden: true,
      createDefault: () => ({ type: 'unknown', props: {} }),
    },
  ])

/** 内建可添加能力。 @public */
export const DEFAULT_COMPOSE_CAPABILITY_DEFINITIONS: readonly ComposeCapabilityDefinition[] =
  Object.freeze([
    {
      id: 'container',
      label: '容器',
      description: '允许当前组件容纳并裁剪子项',
      createComponents: () => ({
        Hierarchy: { childIds: [] },
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
