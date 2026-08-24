import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  BUILTIN_COMMAND_TYPES,
  createComposeFrameEntity,
  createDefaultCanvasSettings,
  validateComposeDocument,
  type ComposeDocument,
  type ComposeEntity,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeBasicMaterials } from '../create-basic-materials'
import { createPortsInspector, createPortsMissingInspectorActions } from './inspector'
import { DEFAULT_COMPOSE_PORTS, nextComposePortId } from './defaults'

afterEach(cleanup)

function seed(
  materials: ReturnType<typeof createComposeBasicMaterials>,
  presetId: string,
  id: string,
): ComposeEntity {
  const result = materials.registry.createSeed(presetId)
  if (!result.ok) throw new Error(result.error.message)
  return { id, ...result.seed }
}

function withPorts(entity: ComposeEntity, ports: ComposeEntity['components'][string]) {
  return { ...entity, components: { ...entity.components, Ports: ports } }
}

describe('OpenSpec: Ports Component 定义与 Inspector', () => {
  it('任意 Entity 都能加端口，加上之后文档仍然合法', () => {
    const materials = createComposeBasicMaterials()
    const definition = materials.componentDefinitions.find(({ key }) => key === 'Ports')
    // 端口是 Entity 的能力，不是组件库的能力：矩形也能有接线点。
    expect(definition?.missingInspector?.isVisible(seed(materials, 'rectangle', 'rect'))).toBe(true)

    const rectangle = withPorts(seed(materials, 'rectangle', 'rect'), {
      items: [{ id: 'L1', position: { x: 0, y: 8 } }],
    })
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
    expect(definition?.validate?.(rectangle.components.Ports!)).toBe(true)
  })

  it('添加端口派发一条命令，初值不是空列表', () => {
    const materials = createComposeBasicMaterials()
    const dispatch = vi.fn()
    const Actions = createPortsMissingInspectorActions(() => 'cmd-1')
    render(<Actions componentKey="Ports" dispatch={dispatch} entity={seed(materials, 'rectangle', 'rect')} readOnly={false} />)

    fireEvent.click(screen.getByRole('button', { name: '添加端口' }))

    expect(dispatch).toHaveBeenCalledTimes(1)
    // 空列表是非法的，因此「添加端口」必须直接给出一个端口。
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: BUILTIN_COMMAND_TYPES.addComponent,
      payload: { entityId: 'rect', key: 'Ports', value: DEFAULT_COMPOSE_PORTS },
    })
  })

  it('编辑位置写回一条 Component 更新命令', () => {
    const materials = createComposeBasicMaterials()
    const entity = withPorts(seed(materials, 'rectangle', 'rect'), {
      items: [{ id: 'L1', position: { x: 0, y: 0 } }],
    })
    const dispatch = vi.fn()
    const Inspector = createPortsInspector(() => 'cmd-1')
    render(
      <Inspector
        componentKey="Ports"
        dispatch={dispatch}
        entity={entity}
        readOnly={false}
        value={entity.components.Ports!}
      />,
    )

    const x = screen.getAllByRole('spinbutton')[0]!
    fireEvent.change(x, { target: { value: '12' } })
    fireEvent.blur(x)

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      type: BUILTIN_COMMAND_TYPES.updateComponent,
      payload: { entityId: 'rect', key: 'Ports', value: { items: [{ id: 'L1', position: { x: 12, y: 0 } }] } },
    })
  })

  it('下一个默认 id 跳过仍在使用的号', () => {
    // 按长度取号会在删掉中间一项之后撞上仍然存在的那个 id。
    expect(nextComposePortId([{ id: 'port-1' }, { id: 'port-3' }])).toBe('port-4')
    expect(nextComposePortId([{ id: 'port-2' }])).toBe('port-3')
  })
})
