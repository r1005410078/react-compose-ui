import { createComponentRegistry } from '@compose-ui/component-registry'
import type { ComponentDefinition } from '@compose-ui/component-registry'
import type { StageFramePreset } from '@compose-ui/stage'
import { createContainerInspector } from './frame'
import { DEFAULT_FRAME_PRESET, createFramePreset } from './frame'
import { DEFAULT_RECTANGLE_DEFINITION, createRectangleDefinition } from './rectangle'
import {
  createDefaultInspectorId,
} from './shared/inspector/dispatch-update'
import { DEFAULT_TEXT_DEFINITION, createTextDefinition } from './text'
import type { BasicMaterials, CreateBasicMaterialsOptions } from './types'

/** `@compose-ui/materials` 的稳定包标识。 @public */
export const COMPOSE_UI_MATERIALS_PACKAGE = '@compose-ui/materials' as const

/** 按 Frame palette 顺序导出的默认 presets。 @public */
export const DEFAULT_BASIC_FRAME_PRESETS: readonly StageFramePreset[] = Object.freeze([
  DEFAULT_FRAME_PRESET,
])

/** 按 Component Library 顺序导出的默认 definitions。 @public */
export const DEFAULT_BASIC_COMPONENT_DEFINITIONS: readonly ComponentDefinition[] = Object.freeze([
  DEFAULT_RECTANGLE_DEFINITION,
  DEFAULT_TEXT_DEFINITION,
])

/**
 * 为一个编辑器实例创建基础物料、registry 与绑定默认值的 Container Inspector。
 *
 * @param options - Frame、Rectangle、Text 覆盖项和末尾宿主扩展。
 * @returns 不共享 registry 或可变文档默认值的实例级组合。
 * @public
 */
export function createBasicMaterials(
  options: CreateBasicMaterialsOptions = {},
): BasicMaterials {
  const idFactory = options.idFactory ?? createDefaultInspectorId
  const framePreset = createFramePreset(options.frame)
  const rectangle = createRectangleDefinition(options.rectangle, idFactory)
  const text = createTextDefinition(options.text, idFactory)
  const componentDefinitions = Object.freeze([
    rectangle,
    text,
    ...(options.extensions ?? []),
  ])
  const framePresets = Object.freeze([framePreset])
  return Object.freeze({
    registry: createComponentRegistry(componentDefinitions),
    componentDefinitions,
    framePresets,
    ContainerInspector: createContainerInspector({
      name: framePreset.name,
      size: framePreset.defaultSize,
      style: framePreset.createDefaultStyle(),
    }, idFactory),
  })
}
