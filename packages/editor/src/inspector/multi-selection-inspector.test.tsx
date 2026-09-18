import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  createComposeEntityRegistry,
  type ComposeRendererInspectorProps,
} from '@compose-ui/component-registry'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import {
  createDefaultCanvasSettings,
  planComposeSetRendererProps,
  type ComposeDocument,
  type ComposeEntity,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import * as v from 'valibot'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MultiSelectionInspector } from './multi-selection-inspector'

afterEach(cleanup)

function curve(
  id: string,
  props: Record<string, unknown>,
  locked = false,
): ComposeEntity {
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: 'curve', baseComponentKeys: [], capabilityIds: [] },
      Lock: { locked },
      Renderer: { type: 'curve', props: props as Record<string, JsonValue> },
    },
  }
}

function textEntity(id: string): ComposeEntity {
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: 'text', baseComponentKeys: [], capabilityIds: [] },
      Lock: { locked: false },
      Renderer: { type: 'text', props: { text: id } },
    },
  }
}

function documentWith(entities: readonly ComposeEntity[]): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: entities.map((entity) => entity.id),
    entities: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
  }
}

/**
 * 一个只有描边两个字段的最小曲线物料。
 *
 * @remarks
 * **不从 `materials` 取真的那一个**：`editor` 不依赖物料包，而这几条用例问的是多选面板把什么
 * 交给了 Renderer Inspector、写入落成了什么命令——那与字段有几个无关。写入刻意走与真物料
 * 同一条 `planComposeSetRendererProps`，否则用例验的就不是产品那条路径了。
 */
const registry = createComposeEntityRegistry({
  renderers: [{
    type: 'curve',
    label: 'Curve',
    renderer: () => null,
    propContracts: [
      { name: 'stroke', kind: 'value', label: 'Stroke', category: 'stroke', validate: () => true },
      {
        name: 'strokeWidth',
        kind: 'value',
        label: 'Stroke width',
        category: 'stroke',
        validate: () => true,
      },
    ],
    propCategories: [{ id: 'stroke', label: '描边', inspectorDefaultExpanded: true }],
    inspector: (context: ComposeRendererInspectorProps) => {
      const schema = v.object({
        stroke: v.pipe(v.string(), v.title('线条颜色')),
        strokeWidth: v.pipe(v.number(), v.title('线条粗细')),
      })
      const props = context.authoredProps
      return (
        <ComposePropertyPanel
          aria-label="描边"
          mixedPaths={context.mixedPropNames
            ? [...context.mixedPropNames].map((name) => [name])
            : undefined}
          readOnly={context.readOnly}
          schema={schema}
          value={{
            stroke: typeof props.stroke === 'string' ? props.stroke : '#fff',
            strokeWidth: typeof props.strokeWidth === 'number' ? props.strokeWidth : 2,
          }}
          onValueChange={(next, change) => {
            const propName = change.path[0]
            if (typeof propName !== 'string' || !(propName in next)) return
            const targets = context.entities ?? [context.entity]
            const command = planComposeSetRendererProps({
              document: context.document!,
              entityIds: targets.map((entity) => entity.id),
              patch: { [propName]: change.value as JsonValue },
              idFactory: () => 'cmd',
            })
            if (command) context.dispatch(command)
          }}
        />
      )
    },
  }],
})

const idFactory = () => 'cmd'

describe('OpenSpec: editor-workspace-layout / 多选 Inspector 编辑共有 Renderer 属性', () => {
  it('同一种 Renderer 出完整字段，改一次写入全部', () => {
    const dispatch = vi.fn<(command: EditorCommand) => unknown>()
    const entities = [
      curve('a', { stroke: '#fff', strokeWidth: 2 }),
      curve('b', { stroke: '#fff', strokeWidth: 5 }),
    ]
    render(
      <MultiSelectionInspector
        dispatch={dispatch}
        document={documentWith(entities)}
        idFactory={idFactory}
        registry={registry}
        selectedIds={['a', 'b']}
      />,
    )

    expect(screen.getByLabelText('线条颜色')).toBeInTheDocument()
    // 有字段可编辑时不再出「只选中一个」——那句话与屏幕上的字段互相矛盾。
    expect(screen.queryByText(/只选中一个/)).toBeNull()

    fireEvent.change(screen.getByLabelText('线条颜色'), { target: { value: '#ff3b30' } })
    fireEvent.blur(screen.getByLabelText('线条颜色'))
    const command = dispatch.mock.calls[0]?.[0]
    expect(command?.type).toBe('transaction.batch')
    expect(command?.meta?.targetIds).toEqual(['a', 'b'])
  })

  it('取值不同的字段标成混合，取值相同的不标', () => {
    const entities = [
      curve('a', { stroke: '#fff', strokeWidth: 2 }),
      curve('b', { stroke: '#fff', strokeWidth: 5 }),
    ]
    const view = render(
      <MultiSelectionInspector
        dispatch={vi.fn()}
        document={documentWith(entities)}
        idFactory={idFactory}
        registry={registry}
        selectedIds={['a', 'b']}
      />,
    )
    const field = (path: string) =>
      view.container.querySelector(`[data-property-path="${path}"]`)
    expect(field('strokeWidth')?.getAttribute('data-property-mixed')).toBe('true')
    expect(field('stroke')?.getAttribute('data-property-mixed')).toBeNull()
  })

  it('混合类型退回空态', () => {
    render(
      <MultiSelectionInspector
        dispatch={vi.fn()}
        document={documentWith([curve('a', { stroke: '#fff' }), textEntity('t')])}
        idFactory={idFactory}
        registry={registry}
        selectedIds={['a', 't']}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('只选中一个')
    expect(screen.queryByLabelText('线条颜色')).toBeNull()
  })

  it('锁定的成员说出来，全部锁定时只读', () => {
    const entities = [
      curve('a', { stroke: '#fff' }),
      curve('locked', { stroke: '#fff' }, true),
    ]
    const { rerender } = render(
      <MultiSelectionInspector
        dispatch={vi.fn()}
        document={documentWith(entities)}
        idFactory={idFactory}
        registry={registry}
        selectedIds={['a', 'locked']}
      />,
    )
    expect(screen.getByText(/1 条已锁定/)).toBeInTheDocument()
    expect(screen.getByLabelText('线条颜色')).not.toHaveAttribute('readonly')

    const allLocked = [curve('a', { stroke: '#fff' }, true), curve('b', { stroke: '#fff' }, true)]
    rerender(
      <MultiSelectionInspector
        dispatch={vi.fn()}
        document={documentWith(allLocked)}
        idFactory={idFactory}
        registry={registry}
        selectedIds={['a', 'b']}
      />,
    )
    expect(screen.getByLabelText('线条颜色')).toHaveAttribute('readonly')
  })
})
