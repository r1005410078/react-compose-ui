import {
  BUILTIN_COMMAND_TYPES,
  getComposeEntityPorts,
  type ComposeDocument,
  type ComposeWire,
  type ComposeWireBinding,
} from '@compose-ui/core'
import type { ComponentType } from 'react'
import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
import { ComposeButton } from '@compose-ui/components'
import { useZh } from '../material-inspector-kit/use-zh'
import type { InspectorIdFactory } from '../material-inspector-kit/renderer-inspectors'

/** 一端的三种状态。 */
type WireEndState = 'free' | 'bound' | 'dangling'

function endState(
  document: ComposeDocument | undefined,
  binding: ComposeWireBinding | undefined,
): WireEndState {
  if (!binding) return 'free'
  const entity = document?.entities[binding.entityId]
  const resolved = getComposeEntityPorts(entity).some(({ id }) => id === binding.portId)
  return resolved ? 'bound' : 'dangling'
}

/**
 * 创建 Wire Component Inspector。
 *
 * @remarks
 * 列出两端的状态，并为绑着的那一端提供解除入口。**改接线的入口仍在画布上**——拖动导线端点
 * 落到端口上即改绑，落到别处即解绑；这里不做一套选目标的下拉，那会产生第二个入口，而它没有
 * 画布那个入口的空间信息。
 *
 * 解除是例外，因为画布上**没有**能只解除绑定而不动几何的手势：拖开端点会连位置一起改。
 * `WIRE` 合并进 `LINE` 之后「端点落在端口上」与「绑定」不再可分，没有这个入口，用户能进入
 * 这个状态却出不来。
 *
 * **失效必须与自由可区分**：两者的几何都来自作者文档，屏幕上看不出差别，而含义完全不同——
 * 一个是作者本来就没接，另一个是接过的东西没了。这与实例动画把失效的清单引用标出来是同一条
 * 判断。失效那一端同样给解除入口，它也需要一条出路。
 *
 * @internal
 */
export function createWireInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function WireInspector({ dispatch, document, entity, readOnly, value }) {
    const zh = useZh()
    const wire = value as ComposeWire
    const label: Record<WireEndState, string> = {
      free: zh ? '自由端' : 'Free',
      bound: zh ? '已绑定' : 'Bound',
      dangling: zh ? '失效' : 'Dangling',
    }
    const rows = [
      { key: 'start' as const, title: zh ? '起点' : 'Start', binding: wire.start },
      { key: 'end' as const, title: zh ? '终点' : 'End', binding: wire.end },
    ]
    const unbind = (key: 'start' | 'end') => {
      const rest = key === 'start' ? wire.end : wire.start
      const other = key === 'start' ? 'end' : 'start'
      const meta = {
        label: zh ? `解除 ${entity.name} 的接线` : `Unbind ${entity.name}`,
        source: 'inspector',
        targetIds: [entity.id],
      }
      // 另一端也没绑时整个 `Wire` 删掉：不带任何绑定的 `Wire` 读不出意图，与曲线外观
      // 「三项全清就整个删掉」是同一条判断。
      dispatch(rest
        ? {
          id: idFactory(),
          type: BUILTIN_COMMAND_TYPES.updateComponent,
          payload: { entityId: entity.id, key: 'Wire', value: { [other]: rest } },
          meta,
        }
        : {
          id: idFactory(),
          type: BUILTIN_COMMAND_TYPES.removeComponent,
          payload: { entityId: entity.id, key: 'Wire' },
          meta,
        })
    }
    return (
      <dl aria-label={zh ? '导线属性' : 'Wire properties'} className="compose-material-wire">
        {rows.map(({ key, title, binding }) => {
          const state = endState(document, binding)
          return (
            <div className="compose-material-wire__row" key={key}>
              <dt>{title}</dt>
              <dd data-testid={`compose-material-wire-${key}`} data-wire-end={state}>
                {state === 'free'
                  ? label.free
                  : `${label[state]}${binding ? `：${binding.entityId} / ${binding.portId}` : ''}`}
              </dd>
              {/* 自由端不给按钮：那里没有可解除的东西，一个恒为禁用的按钮只会让人以为它坏了。 */}
              {state === 'free' ? null : (
                <ComposeButton
                  data-testid={`compose-material-wire-unbind-${key}`}
                  disabled={readOnly}
                  size="sm"
                  variant="ghost"
                  onClick={() => unbind(key)}
                >
                  {zh ? '解除' : 'Unbind'}
                </ComposeButton>
              )}
            </div>
          )
        })}
      </dl>
    )
  }
}
