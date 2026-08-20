import { useMemo } from 'react'
import * as v from 'valibot'
import {
  BUILTIN_COMMAND_TYPES,
  type ComposeInteraction,
  type ComposeInteractionTrigger,
  type JsonObject,
} from '@compose-ui/core'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import type { ComponentType } from 'react'
import type {
  ComposeComponentInspectorProps,
  ComposeMissingComponentInspectorProps,
} from '@compose-ui/component-registry'
import { ComposeButton } from '@compose-ui/components'
import { useZh } from '../material-inspector-kit/use-zh'
import { composeNodePropertySchema } from '../material-inspector-kit/node'
import type { InspectorIdFactory } from '../material-inspector-kit/renderer-inspectors'
import { DEFAULT_COMPOSE_INTERACTION } from './defaults'

/** v1 支持的事件；数组上限与它等长。 */
const INTERACTION_EVENTS = ['click'] as const

function interactionSchema(zh: boolean) {
  return v.object({
    triggers: v.pipe(
      v.array(v.object({
        event: v.pipe(
          v.picklist(INTERACTION_EVENTS),
          v.title(zh ? '事件' : 'Event'),
          v.metadata({ propertyPanel: { optionLabels: { click: zh ? '点击' : 'Click' } } }),
        ),
        action: v.pipe(
          v.variant('type', [
            v.pipe(
              v.object({
                // 分支选择器已经表达了动作类型，再显示一行只读 type 是同一信息的第二份呈现。
                type: v.pipe(v.literal('navigate'), v.metadata({ propertyPanel: { hidden: true } })),
                target: composeNodePropertySchema({ title: zh ? '目标页面' : 'Target page' }),
              }),
              v.title(zh ? '跳转到页面' : 'Go to page'),
            ),
            v.pipe(
              v.object({
                type: v.pipe(
                  v.literal('navigate-back'),
                  v.metadata({ propertyPanel: { hidden: true } }),
                ),
              }),
              v.title(zh ? '返回上一页' : 'Go back'),
            ),
          ]),
          v.title(zh ? '动作' : 'Action'),
        ),
      })),
      // 每个事件最多一条 trigger，而 v1 只有 click，因此上限就是 1。没有这条上限，
      // 面板会允许加出第二行 click，而文档校验拒绝重复事件——用户只会看到"点了没反应"。
      v.maxLength(INTERACTION_EVENTS.length),
      v.title(zh ? '触发' : 'Triggers'),
    ),
  })
}

/** 面板值：只含 Schema 覆盖的字段，因此直接从 Schema 推导而不是另写一份。 */
type InteractionPanelValue = v.InferOutput<ReturnType<typeof interactionSchema>>

function readTriggers(value: JsonObject): readonly ComposeInteractionTrigger[] {
  const triggers = (value as unknown as ComposeInteraction).triggers
  return Array.isArray(triggers) ? triggers : []
}

/**
 * 创建 Interaction Component Inspector。
 *
 * @remarks
 * 目标页面复用 node editor：它已经承担了候选列举、页面拖入赋值与"已删除的页面"呈现，
 * 另建一套页面选择器只会让两处的失效文案漂移。
 *
 * 写回时按 index 合并回原 trigger 的 `params`——v1 没有编辑 params 的 UI，但协议允许它
 * 存在，Schema 之外的字段不能因为过一遍面板就丢掉。
 *
 * @internal
 */
export function createInteractionInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function InteractionInspector({ entity, dispatch, nodeEditPort, readOnly, value }) {
    const zh = useZh()
    const schema = useMemo(() => interactionSchema(zh), [zh])
    const triggers = readTriggers(value)
    const panelValue: InteractionPanelValue = {
      triggers: triggers.map((trigger) => ({
        event: trigger.event,
        action: trigger.action.type === 'navigate'
          ? { type: 'navigate' as const, target: trigger.action.target }
          : { type: 'navigate-back' as const },
      })),
    }

    return (
      <ComposePropertyPanel
        aria-label={zh ? '交互属性' : 'Interaction properties'}
        defaultValue={{ triggers: [] } satisfies InteractionPanelValue}
        nodeEditor={nodeEditPort}
        readOnly={readOnly}
        schema={schema}
        value={panelValue}
        onValueChange={(next) => {
          if (readOnly) return
          const nextTriggers = next.triggers.map((trigger, index) => {
            if (trigger.action.type !== 'navigate') return trigger
            const params = triggers[index]?.action.type === 'navigate'
              ? (triggers[index].action as { readonly params?: JsonObject }).params
              : undefined
            return params === undefined
              ? trigger
              : { ...trigger, action: { ...trigger.action, params } }
          })
          dispatch({
            id: idFactory(),
            type: BUILTIN_COMMAND_TYPES.updateComponent,
            payload: {
              entityId: entity.id,
              key: 'Interaction',
              value: { version: 1, triggers: nextTriggers },
            },
            meta: {
              label: zh ? `编辑 ${entity.name} 的交互` : `Edit ${entity.name} interaction`,
              source: 'inspector',
              targetIds: [entity.id],
              mergeKey: `inspector:${entity.id}:interaction`,
            },
          })
        }}
      />
    )
  }
}

/**
 * 创建缺失 Interaction 时的添加入口。
 *
 * @remarks
 * 任意 Entity 都可以有交互，因此没有可见性条件——不像 Layout 只对容器有意义。
 * @internal
 */
export function createInteractionMissingInspectorActions(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeMissingComponentInspectorProps> {
  return function InteractionMissingInspectorActions({ entity, dispatch, readOnly }) {
    const zh = useZh()
    return (
      <ComposeButton
        aria-label={zh ? '添加交互' : 'Add interaction'}
        disabled={readOnly}
        size="sm"
        variant="ghost"
        onClick={() => {
          if (readOnly) return
          dispatch({
            id: idFactory(),
            type: BUILTIN_COMMAND_TYPES.addComponent,
            payload: {
              entityId: entity.id,
              key: 'Interaction',
              value: { ...DEFAULT_COMPOSE_INTERACTION },
            },
            meta: {
              label: zh ? `为 ${entity.name} 添加交互` : `Add interaction to ${entity.name}`,
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
