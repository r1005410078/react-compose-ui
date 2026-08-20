import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import {
  BUILTIN_COMMAND_TYPES,
  validateComposeDocument,
  createDefaultCanvasSettings,
  createComposeFrameEntity,
  type ComposeDocument,
  type ComposeEntity,
  type ComposePageReference,
} from '@compose-ui/core'
import type { ComposeNodeEditPort } from '@compose-ui/component-registry'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeBasicMaterials } from '../create-basic-materials'
import {
  createInteractionInspector,
  createInteractionMissingInspectorActions,
} from './inspector'
import { DEFAULT_COMPOSE_INTERACTION } from './defaults'

afterEach(cleanup)

const DETAIL: ComposePageReference = {
  kind: 'page',
  providerId: 'demo',
  assetKey: 'pages/detail.page.json',
  scope: 'persistent',
}

function seed(
  materials: ReturnType<typeof createComposeBasicMaterials>,
  presetId: string,
  id: string,
): ComposeEntity {
  const result = materials.registry.createSeed(presetId)
  if (!result.ok) throw new Error(result.error.message)
  return { id, ...result.seed }
}

function withInteraction(entity: ComposeEntity, interaction: ComposeEntity['components'][string]) {
  return { ...entity, components: { ...entity.components, Interaction: interaction } }
}

/** 只列出一个页面候选；缺失状态由目录里查不到 assetKey 触发。 */
function nodePort(available: readonly ComposePageReference[]): ComposeNodeEditPort {
  return {
    dragMediaTypes: ['application/x-compose-asset-reference'],
    candidates: available.map((reference) => ({
      id: reference.assetKey,
      label: '详情页',
      value: reference,
    })),
    parseDrop: () => null,
    resolveLabel: (value) => {
      const reference = value as ComposePageReference | null
      if (!reference) return '无效的页面引用'
      return available.some((item) => item.assetKey === reference.assetKey)
        ? '详情页'
        : `已删除的页面 (${reference.assetKey})`
    },
  }
}

function renderInspector(entity: ComposeEntity, port?: ComposeNodeEditPort) {
  const dispatch = vi.fn()
  const Inspector = createInteractionInspector(() => 'cmd-1')
  render(
    <Inspector
      componentKey="Interaction"
      dispatch={dispatch}
      entity={entity}
      nodeEditPort={port}
      readOnly={false}
      value={entity.components.Interaction!}
    />,
  )
  return dispatch
}

describe('OpenSpec: Interaction Component 定义与 Inspector', () => {
  it('给矩形添加跳转', () => {
    const materials = createComposeBasicMaterials()
    const rectangle = seed(materials, 'rectangle', 'rect')
    const dispatch = vi.fn()
    const Actions = createInteractionMissingInspectorActions(() => 'cmd-1')
    render(
      <Actions componentKey="Interaction" dispatch={dispatch} entity={rectangle} readOnly={false} />,
    )

    fireEvent.click(screen.getByRole('button', { name: '添加交互' }))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: BUILTIN_COMMAND_TYPES.addComponent,
      payload: { entityId: 'rect', key: 'Interaction', value: DEFAULT_COMPOSE_INTERACTION },
    })
  })

  it('任意 Entity 都能加交互，加上之后文档仍然合法', () => {
    const materials = createComposeBasicMaterials()
    const definition = materials.componentDefinitions.find(({ key }) => key === 'Interaction')
    expect(definition?.missingInspector?.isVisible(seed(materials, 'rectangle', 'rect'))).toBe(true)

    const rectangle = withInteraction(
      seed(materials, 'rectangle', 'rect'),
      { version: 1, triggers: [{ event: 'click', action: { type: 'navigate', target: DETAIL } }] },
    )
    const document: ComposeDocument = {
      schemaVersion: 7,
      canvas: createDefaultCanvasSettings(),
      rootIds: ['frame'],
      entities: {
        rect: rectangle,
        frame: createComposeFrameEntity({
          id: 'frame',
          childIds: ['rect'],
          size: { width: 400, height: 300 },
        }),
      },
    }
    expect(validateComposeDocument(document).valid).toBe(true)
    expect(definition?.validate?.(rectangle.components.Interaction!)).toBe(true)
  })

  it('选择目标页面写入稳定引用', () => {
    const materials = createComposeBasicMaterials()
    const entity = withInteraction(
      seed(materials, 'rectangle', 'rect'),
      DEFAULT_COMPOSE_INTERACTION,
    )
    const dispatch = renderInspector(entity, nodePort([DETAIL]))

    // node editor 的触发按钮没有 accessible name（property-panel 的既有行为），
    // 因此从它自己的 testid 容器里取，而不是靠角色加名称。
    fireEvent.click(within(screen.getByTestId('semantic-editor-node')).getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: '详情页' }))

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: BUILTIN_COMMAND_TYPES.updateComponent,
      payload: {
        entityId: 'rect',
        key: 'Interaction',
        value: { version: 1, triggers: [{ event: 'click', action: { type: 'navigate', target: DETAIL } }] },
      },
    })
  })

  it('目标页面缺失时呈现明确状态且不改写文档', () => {
    const materials = createComposeBasicMaterials()
    const entity = withInteraction(
      seed(materials, 'rectangle', 'rect'),
      { version: 1, triggers: [{ event: 'click', action: { type: 'navigate', target: DETAIL } }] },
    )
    // 目录里没有这个页面：引用仍然留在文档里，只是标签告诉用户它没了。
    const dispatch = renderInspector(entity, nodePort([]))

    expect(screen.getByText(`已删除的页面 (${DETAIL.assetKey})`)).toBeTruthy()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('移除 trigger 只发一条命令且保留 Interaction', () => {
    const materials = createComposeBasicMaterials()
    const entity = withInteraction(
      seed(materials, 'rectangle', 'rect'),
      { version: 1, triggers: [{ event: 'click', action: { type: 'navigate', target: DETAIL } }] },
    )
    const dispatch = renderInspector(entity, nodePort([DETAIL]))

    fireEvent.click(screen.getByRole('button', { name: '删除 触发 1' }))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: BUILTIN_COMMAND_TYPES.updateComponent,
      payload: { entityId: 'rect', key: 'Interaction', value: { version: 1, triggers: [] } },
    })
  })

  it('已有 click 时不会再产生第二条同事件 trigger', () => {
    const materials = createComposeBasicMaterials()
    const entity = withInteraction(
      seed(materials, 'rectangle', 'rect'),
      DEFAULT_COMPOSE_INTERACTION,
    )
    const dispatch = renderInspector(entity, nodePort([DETAIL]))

    // 面板只提交通过 Schema 校验的候选值，因此超出上限的新增不会派发无效命令。
    fireEvent.click(screen.getByRole('button', { name: '添加 触发' }))
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('写回保留 Schema 之外的 params', () => {
    const materials = createComposeBasicMaterials()
    const entity = withInteraction(
      seed(materials, 'rectangle', 'rect'),
      {
        version: 1,
        triggers: [{
          event: 'click',
          action: { type: 'navigate', target: null, params: { from: 'home' } },
        }],
      },
    )
    const dispatch = renderInspector(entity, nodePort([DETAIL]))

    // node editor 的触发按钮没有 accessible name（property-panel 的既有行为），
    // 因此从它自己的 testid 容器里取，而不是靠角色加名称。
    fireEvent.click(within(screen.getByTestId('semantic-editor-node')).getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: '详情页' }))

    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      payload: {
        value: {
          triggers: [{
            action: { type: 'navigate', target: DETAIL, params: { from: 'home' } },
          }],
        },
      },
    })
  })

  it('Interaction 注册为可选 Component 且带 Inspector', () => {
    const materials = createComposeBasicMaterials()
    const definition = materials.componentDefinitions.find(({ key }) => key === 'Interaction')
    expect(definition?.label).toBe('交互')
    expect(definition?.inspector).toBeTruthy()
    expect(definition?.createDefault?.()).toEqual(DEFAULT_COMPOSE_INTERACTION)
  })
})
