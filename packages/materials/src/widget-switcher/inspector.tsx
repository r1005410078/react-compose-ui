import { useMemo } from 'react'
import * as v from 'valibot'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeHierarchy,
  type ComposeWidgetSwitcher,
} from '@compose-ui/core'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import type { ComponentType } from 'react'
import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
import { useZh } from '../material-inspector-kit/use-zh'
import type { InspectorIdFactory } from '../material-inspector-kit/renderer-inspectors'
import { DEFAULT_WIDGET_SWITCHER } from './defaults'

/**
 * 创建 WidgetSwitcher Component Inspector。
 *
 * @remarks
 * 只编辑活动索引。子项数量由「容器」分组的 Hierarchy Inspector 呈现，这里不重复一份，
 * 否则同一个面板会出现两个同名只读字段。索引上界跟随当前子项数；文档中允许存在越界值
 * （子项删除后不回写），因此这里只约束新输入。
 *
 * @internal
 */
export function createWidgetSwitcherInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function WidgetSwitcherInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const childIds = getComposeHierarchy(entity)?.childIds ?? []
    const maxIndex = Math.max(childIds.length - 1, 0)
    const schema = useMemo(() => v.object({
      activeIndex: v.pipe(
        v.number(),
        v.integer(),
        v.minValue(0),
        v.maxValue(maxIndex),
        v.title(zh ? '活动索引' : 'Active index'),
      ),
    }), [maxIndex, zh])
    const activeIndex = (value as ComposeWidgetSwitcher).activeIndex
    return (
      <ComposePropertyPanel
        aria-label={zh ? '切换器属性' : 'Widget switcher properties'}
        defaultValue={{ activeIndex: DEFAULT_WIDGET_SWITCHER.activeIndex }}
        readOnly={readOnly}
        schema={schema}
        value={{ activeIndex: Number.isInteger(activeIndex) ? activeIndex : 0 }}
        onValueChange={(next) => {
          if (readOnly) return
          dispatch({
            id: idFactory(),
            type: BUILTIN_COMMAND_TYPES.updateComponent,
            payload: {
              entityId: entity.id,
              key: 'WidgetSwitcher',
              value: { activeIndex: next.activeIndex },
            },
            meta: {
              label: zh
                ? `切换 ${entity.name} 到索引 ${next.activeIndex}`
                : `Switch ${entity.name} to index ${next.activeIndex}`,
              source: 'inspector',
              targetIds: [entity.id],
              mergeKey: `inspector:${entity.id}:widget-switcher`,
            },
          })
        }}
      />
    )
  }
}
