import { getComposeEntityPorts, type ComposeDocument, type ComposeWire, type ComposeWireBinding } from '@compose-ui/core'
import type { ComponentType } from 'react'
import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
import { useZh } from '../material-inspector-kit/use-zh'

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
 * 只读地列出两端的状态，因为改接线的入口在画布上——拖动导线端点落到端口上即改绑，落到别处即
 * 解绑。在这里再做一套下拉会产生第二个入口，而它没有画布那个入口的空间信息。
 *
 * **失效必须与自由可区分**：两者的几何都来自作者文档，屏幕上看不出差别，而含义完全不同——
 * 一个是作者本来就没接，另一个是接过的东西没了。这与实例动画把失效的清单引用标出来是同一条
 * 判断。
 *
 * @internal
 */
export function createWireInspector(): ComponentType<ComposeComponentInspectorProps> {
  return function WireInspector({ document, value }) {
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
            </div>
          )
        })}
      </dl>
    )
  }
}
