import { useMemo } from 'react'
import * as v from 'valibot'
import { BUILTIN_COMMAND_TYPES, type ComposePort, type JsonObject } from '@compose-ui/core'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import { ComposeButton } from '@compose-ui/components'
import type { ComponentType } from 'react'
import type {
  ComposeComponentInspectorProps,
  ComposeMissingComponentInspectorProps,
} from '@compose-ui/component-registry'
import { useZh } from '../material-inspector-kit/use-zh'
import type { InspectorIdFactory } from '../material-inspector-kit/renderer-inspectors'
import { DEFAULT_COMPOSE_PORTS, nextComposePortId } from './defaults'

function portsSchema(zh: boolean) {
  return v.object({
    items: v.pipe(
      v.array(v.object({
        id: v.pipe(v.string(), v.title('ID')),
        position: v.pipe(
          v.object({ x: v.number(), y: v.number() }),
          v.title(zh ? '位置' : 'Position'),
          v.metadata({ propertyPanel: { editor: 'vector2' } }),
        ),
      })),
      v.title(zh ? '端口' : 'Ports'),
    ),
  })
}

function readItems(value: JsonObject): readonly ComposePort[] {
  const items = (value as unknown as { readonly items?: unknown }).items
  return Array.isArray(items) ? items as readonly ComposePort[] : []
}

/**
 * 创建 Ports Component Inspector。
 *
 * @remarks
 * 端口在图面上不绘制标记，靠捕捉标记在光标靠近时显出来——常驻标记会让一张接线图上多出几十个
 * 与几何无关的点。因此本面板是用户确认「这个符号有哪些接线点」的唯一入口。
 *
 * 新增项由面板的数组编辑器产出，因此这里补上 id：面板不知道 id 必须唯一，而重复 id 会让
 * 将来的导线绑定指向「其中一个」。
 *
 * @internal
 */
export function createPortsInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function PortsInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const schema = useMemo(() => portsSchema(zh), [zh])
    const items = readItems(value)

    return (
      <ComposePropertyPanel
        aria-label={zh ? '端口属性' : 'Port properties'}
        readOnly={readOnly}
        schema={schema}
        value={{ items: items.map(({ id, position }) => ({ id, position })) }}
        onValueChange={(next) => {
          if (readOnly) return
          const seen = new Set<string>()
          const nextItems = next.items.map((item) => {
            const id = item.id !== '' && !seen.has(item.id)
              ? item.id
              : nextComposePortId([...items, ...[...seen].map((used) => ({ id: used }))])
            seen.add(id)
            return { id, position: item.position }
          })
          dispatch({
            id: idFactory(),
            type: BUILTIN_COMMAND_TYPES.updateComponent,
            payload: { entityId: entity.id, key: 'Ports', value: { items: nextItems } },
            meta: {
              label: zh ? `编辑 ${entity.name} 的端口` : `Edit ${entity.name} ports`,
              source: 'inspector',
              targetIds: [entity.id],
              mergeKey: `inspector:${entity.id}:ports`,
            },
          })
        }}
      />
    )
  }
}

/**
 * 创建缺失 Ports 时的添加入口。
 *
 * @remarks
 * 任意 Entity 都可以有端口——端口是 Entity 的能力，不是组件库的能力，因此没有可见性条件。
 * @internal
 */
export function createPortsMissingInspectorActions(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeMissingComponentInspectorProps> {
  return function PortsMissingInspectorActions({ entity, dispatch, readOnly }) {
    const zh = useZh()
    return (
      <ComposeButton
        aria-label={zh ? '添加端口' : 'Add port'}
        disabled={readOnly}
        size="sm"
        variant="ghost"
        onClick={() => {
          if (readOnly) return
          dispatch({
            id: idFactory(),
            type: BUILTIN_COMMAND_TYPES.addComponent,
            payload: { entityId: entity.id, key: 'Ports', value: { ...DEFAULT_COMPOSE_PORTS } },
            meta: {
              label: zh ? `为 ${entity.name} 添加端口` : `Add port to ${entity.name}`,
              source: 'inspector',
              targetIds: [entity.id],
            },
          })
        }}
      >
        +
      </ComposeButton>
    )
  }
}
