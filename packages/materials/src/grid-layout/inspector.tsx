import { useMemo } from 'react'
import type { ComponentType } from 'react'
import * as v from 'valibot'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultComposeGridLayout,
  type ComposeEdges,
  type ComposeEntity,
  type ComposeGridLayout,
  type EditorCommand,
} from '@compose-ui/core'
import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import { isInspectorEdgesValue } from '../material-inspector-kit/edge-model'
import type { InspectorIdFactory } from '../material-inspector-kit/renderer-inspectors'
import { useZh } from '../material-inspector-kit/use-zh'
import { FLEX_RENDERERS } from '../flex-layout/flex-renderers'
import { ResetLayoutIcon } from '../flex-layout/icons'
import { LayoutActionMenu } from '../flex-layout/layout-action-menu'
import { GridColumnBar } from './grid-column-bar'
import {
  planReflowComposeGridLayout,
  planRemoveComposeGridLayout,
  planSwitchComposeLayoutType,
} from './grid-mode-commands'

/** 网格分组的字段值；与 {@link ComposeGridLayout} 一一对应，只把两轴间距收成一对。 */
interface GridInspectorValue {
  readonly columns: number
  readonly rowHeight: number
  readonly gap: { readonly rowGap: number; readonly columnGap: number }
  readonly padding: ComposeEdges
  readonly float: boolean
}

function sameGridLayout(left: ComposeGridLayout, right: ComposeGridLayout): boolean {
  return left.columns === right.columns
    && left.rowHeight === right.rowHeight
    && left.rowGap === right.rowGap
    && left.columnGap === right.columnGap
    && left.float === right.float
    && (['top', 'right', 'bottom', 'left'] as const)
      .every((edge) => left.padding[edge] === right.padding[edge])
}

function createGridCommand(
  idFactory: InspectorIdFactory,
  entity: ComposeEntity,
  value: ComposeGridLayout,
  zh: boolean,
  reset = false,
): EditorCommand {
  return {
    id: idFactory(),
    type: BUILTIN_COMMAND_TYPES.updateComponent,
    payload: { entityId: entity.id, key: 'Layout', value },
    meta: {
      label: zh
        ? `${reset ? '重置' : '修改'} ${entity.name} 网格`
        : `${reset ? 'Reset' : 'Update'} ${entity.name} grid`,
      source: 'inspector',
      targetIds: [entity.id],
      mergeKey: `inspector:${entity.id}:${BUILTIN_COMMAND_TYPES.updateComponent}`,
    },
  }
}

/**
 * 网格分组的标题栏：布局类型标记、整体重置与更多操作。
 *
 * @remarks
 * **类型标记必须渲染**：两种布局共用「布局」这一个分组标题，不印出来用户就分不出当前
 * 面前的是哪一种——而两者的字段集合完全不同，读错一次就会去找一个根本不存在的字段。
 *
 * @internal
 */
export function createGridInspectorHeaderActions(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function GridInspectorHeaderActions({
    document,
    entity,
    dispatch,
    layoutSnapshot,
    readOnly,
    value,
  }) {
    const zh = useZh()
    const layout = value as ComposeGridLayout
    const defaults = createDefaultComposeGridLayout()
    const disabled = readOnly || sameGridLayout(layout, defaults)
    return (
      <div className="flex-layout-inspector__header-actions">
        <span className="flex-layout-inspector__status" data-testid="grid-layout-status">Grid</span>
        <button
          aria-label={zh ? '重置网格' : 'Reset grid'}
          disabled={disabled}
          title={zh ? '重置网格' : 'Reset grid'}
          type="button"
          onClick={() => {
            if (disabled) return
            dispatch(createGridCommand(idFactory, entity, defaults, zh, true))
          }}
        >
          <ResetLayoutIcon />
        </button>
        <LayoutActionMenu
          items={[
            {
              label: zh ? '切换为自动布局' : 'Switch to Auto Layout',
              // 代价写在入口上：两个方向都会丢掉一半信息，而它们都推导不回来。
              content: (
                <>
                  <span>{zh ? '切换为自动布局' : 'Switch to Auto Layout'}</span>
                  <code>{zh ? '丢弃格坐标' : 'discards cells'}</code>
                </>
              ),
              disabled: readOnly || !document,
              onSelect: () => {
                if (!document) return
                const plan = planSwitchComposeLayoutType(
                  document,
                  entity.id,
                  'flex',
                  layoutSnapshot,
                  idFactory,
                )
                if (plan.ok) dispatch(plan.command)
              },
            },
            {
              label: zh ? '按当前几何重新落位' : 'Reflow to current geometry',
              // 落位是在启用那一刻按**当时**的网格参数从像素推出来的，而菜单只给默认网格；
              // 行高/间距/内边距改过之后，先前的格坐标不再对应作者画出来的版面。
              // 它不自动重推——格坐标此后是作者的显式意图；这里给的是那条显式入口。
              content: (
                <>
                  <span>{zh ? '按当前几何重新落位' : 'Reflow to current geometry'}</span>
                  <code>{zh ? '按像素重推格坐标' : 'from pixel boxes'}</code>
                </>
              ),
              disabled: readOnly || !document || !layoutSnapshot,
              title: !layoutSnapshot
                ? (zh ? '布局结果尚未就绪' : 'Layout result is not ready')
                : undefined,
              onSelect: () => {
                if (!document) return
                const plan = planReflowComposeGridLayout(
                  document,
                  entity.id,
                  layoutSnapshot,
                  idFactory,
                )
                if (plan.ok) dispatch(plan.command)
              },
            },
            {
              label: zh ? '移除网格' : 'Remove grid',
              content: (
                <>
                  <span>{zh ? '移除网格' : 'Remove grid'}</span>
                  <code>{zh ? '烘焙为绝对定位' : 'bake to absolute'}</code>
                </>
              ),
              disabled: readOnly || !document || !layoutSnapshot,
              title: !layoutSnapshot
                ? (zh ? '布局结果尚未就绪' : 'Layout result is not ready')
                : undefined,
              onSelect: () => {
                if (!document) return
                const plan = planRemoveComposeGridLayout(
                  document,
                  entity.id,
                  layoutSnapshot,
                  idFactory,
                )
                if (plan.ok) dispatch(plan.command)
              },
            },
          ]}
          menuLabel={zh ? '网格操作' : 'Grid actions'}
          trigger="⋯"
          triggerLabel={zh ? '更多网格操作' : 'More grid actions'}
        />
      </div>
    )
  }
}

/**
 * 网格 Layout 的 Inspector。
 *
 * @remarks
 * 五个字段，其中**项间距与内边距直接复用 Auto Layout 的 editor**（`FLEX_RENDERERS` 的
 * `gap` / `padding`）：两者都不含任何 flex 语义——一个是两轴数值对、一个是四边数值——
 * 各写一份会让「间距」这件事在两种布局里长得不一样。
 *
 * **不渲染 Auto Layout 那样的三节点实时预览**：flex 需要它是因为 `alignContent` /
 * `justifyContent` / `alignItems` 三个词抽象、图标难认；网格的字段全是数字，而画布本身
 * 就是结果，再画一个小的等于同一句话说两遍。只有列数带一条内联指示条——12 与 8 的差别
 * 在画布上要数格子。
 *
 * @internal
 */
export function createGridInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function GridInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const layout = value as ComposeGridLayout
    const schema = useMemo(() => v.object({
      columns: v.pipe(
        v.number(),
        v.integer(zh ? '列数必须是整数' : 'Columns must be an integer'),
        v.minValue(1),
        v.title(zh ? '列数' : 'Columns'),
      ),
      rowHeight: v.pipe(
        v.number(),
        v.minValue(1),
        v.title(zh ? '行高' : 'Row height'),
      ),
      gap: v.pipe(
        v.object({
          rowGap: v.pipe(v.number(), v.minValue(0)),
          columnGap: v.pipe(v.number(), v.minValue(0)),
        }),
        v.title(zh ? '项间距' : 'Item gap'),
        v.metadata({ propertyPanel: { editor: 'gap' } }),
      ),
      padding: v.pipe(
        v.custom<ComposeEdges>((candidate) => isInspectorEdgesValue(candidate)
          && candidate.top >= 0
          && candidate.right >= 0
          && candidate.bottom >= 0
          && candidate.left >= 0),
        v.title(zh ? '内边距' : 'Padding'),
        v.metadata({ propertyPanel: { editor: 'padding' } }),
      ),
      float: v.pipe(
        v.boolean(),
        v.title(zh ? '空洞自动填上' : 'Fill gaps'),
        v.description(zh
          ? '关掉时子项停在你放的行上，中间允许留空。'
          : 'Turn off to keep items on the row you put them, leaving gaps.'),
      ),
    }), [zh])

    return (
      <div
        aria-label={zh ? '网格属性' : 'Grid properties'}
        className="flex-layout-inspector"
        role="group"
      >
        <ComposePropertyPanel
          readOnly={readOnly}
          renderers={FLEX_RENDERERS}
          schema={schema}
          value={{
            columns: layout.columns,
            rowHeight: layout.rowHeight,
            gap: { rowGap: layout.rowGap, columnGap: layout.columnGap },
            padding: layout.padding,
            // 面板上问的是「空洞自动填上吗」，而协议字段 `float` 的真值含义正好相反
            // （GridStack 的 `float: true` 是「停在原地」）。在这里翻转一次，让用户读到的
            // 那句话是肯定式的——开关的标签写成否定式（「不自动填上」）是一类已知的坏设计。
            float: !layout.float,
          } satisfies GridInspectorValue}
          onValueChange={(next) => {
            if (readOnly) return
            dispatch(createGridCommand(idFactory, entity, {
              type: 'grid',
              columns: Math.max(1, Math.round(next.columns)),
              rowHeight: next.rowHeight,
              rowGap: next.gap.rowGap,
              columnGap: next.gap.columnGap,
              padding: next.padding,
              float: !next.float,
            }, zh))
          }}
        />
        <GridColumnBar columns={layout.columns} />
      </div>
    )
  }
}
