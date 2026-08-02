import { useMemo } from 'react'
import type { ComponentType } from 'react'
import * as v from 'valibot'
import {
  BUILTIN_COMMAND_TYPES,
  createDefaultComposeFlexLayout,
  type ComposeEdges,
  type ComposeEntity,
  type ComposeFlexLayout,
  type EditorCommand,
} from '@compose-ui/core'
import type {
  ComposeComponentInspectorProps,
  ComposeMissingComponentInspectorProps,
} from '@compose-ui/component-registry'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import { isInspectorEdgesValue } from '../material-inspector-kit/edge-model'
import type { InspectorIdFactory } from '../material-inspector-kit/renderer-inspectors'
import { useZh } from '../material-inspector-kit/use-zh'
import { flexOptionValues, sameLayout } from './flex-options'
import { FlexDirectionIconContext } from './flex-direction-context'
import { FLEX_RENDERERS } from './flex-renderers'
import { ResetLayoutIcon } from './icons'
import { LayoutActionMenu } from './layout-action-menu'
import { FlexLayoutPreview } from './layout-preview'
import {
  planEnableComposeAutoLayout,
  planRemoveComposeAutoLayout,
} from './layout-mode-commands'

function createLayoutCommand(
  idFactory: InspectorIdFactory,
  entity: ComposeEntity,
  value: ComposeFlexLayout,
  zh: boolean,
  reset = false,
): EditorCommand {
  return {
    id: idFactory(),
    type: BUILTIN_COMMAND_TYPES.updateComponent,
    payload: {
      entityId: entity.id,
      key: 'Layout',
      value,
    },
    meta: {
      label: zh
        ? `${reset ? '重置' : '修改'} ${entity.name} 布局`
        : `${reset ? 'Reset' : 'Update'} ${entity.name} layout`,
      source: 'inspector',
      targetIds: [entity.id],
      mergeKey: `inspector:${entity.id}:${BUILTIN_COMMAND_TYPES.updateComponent}`,
    },
  }
}


export function createLayoutMissingInspectorActions(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeMissingComponentInspectorProps> {
  return function LayoutMissingInspectorActions({ document, entity, dispatch, readOnly }) {
    const zh = useZh()
    const availability = document && !readOnly
      ? planEnableComposeAutoLayout(document, entity.id, () => 'layout-availability-probe')
      : null
    return (
      <LayoutActionMenu
        disabled={readOnly || !document}
        items={[{
          label: 'Auto Layout display: flex',
          disabled: !availability?.ok,
          title: availability && !availability.ok ? availability.issue.message : undefined,
          content: (
            <>
              <span>Auto Layout</span>
              <code>display: flex</code>
            </>
          ),
          onSelect: () => {
            if (!document) return
            const plan = planEnableComposeAutoLayout(document, entity.id, idFactory)
            if (plan.ok) dispatch(plan.command)
          },
        }]}
        menuLabel={zh ? '布局类型' : 'Layout type'}
        trigger="+"
        triggerLabel={zh ? '添加布局' : 'Add layout'}
      />
    )
  }
}

/** 创建缺失 Layout 时的可折叠引导正文。 @internal */
export function createLayoutMissingInspectorContent(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeMissingComponentInspectorProps> {
  return function LayoutMissingInspectorContent({ document, entity, dispatch, readOnly }) {
    const zh = useZh()
    const availability = document && !readOnly
      ? planEnableComposeAutoLayout(document, entity.id, () => 'layout-availability-probe')
      : null
    const disabled = !availability?.ok
    const disabledReason = readOnly
      ? (zh ? '锁定容器不能启用自动布局' : 'Locked containers cannot enable Auto Layout')
      : !document
        ? (zh ? '文档尚未就绪' : 'Document is not ready')
        : availability && !availability.ok ? availability.issue.message : undefined
    return (
      <div className="flex-layout-inspector__empty-guide">
        <svg
          aria-hidden="true"
          className="flex-layout-inspector__empty-icon"
          fill="none"
          viewBox="0 0 72 44"
        >
          <path d="M7 10h58M7 10l6-5M7 10l6 5M65 10l-6-5M65 10l-6 5" />
          <rect height="15" rx="1" width="16" x="8" y="23" />
          <rect height="15" rx="1" width="16" x="28" y="23" />
          <rect height="15" rx="1" width="16" x="48" y="23" />
          <path d="M3 30.5h5M64 30.5h5M3 30.5l3-3M3 30.5l3 3M69 30.5l-3-3M69 30.5l-3 3" />
        </svg>
        <div className="flex-layout-inspector__empty-copy">
          <strong>{zh ? '使用自动布局' : 'Use Auto Layout'}</strong>
          <p>
            {zh
              ? '自动排列子项，并统一控制方向、间距、换行与对齐。'
              : 'Arrange children and control direction, gap, wrapping, and alignment.'}
          </p>
          <div className="flex-layout-inspector__empty-actions">
            <button
              aria-label={zh ? '添加自动布局' : 'Add Auto Layout'}
              disabled={disabled}
              title={disabledReason}
              type="button"
              onClick={() => {
                if (!document || disabled) return
                const plan = planEnableComposeAutoLayout(document, entity.id, idFactory)
                if (plan.ok) dispatch(plan.command)
              }}
            >
              <span aria-hidden="true">＋</span>
              {zh ? '添加自动布局' : 'Add Auto Layout'}
            </button>
            <span>{zh ? '添加后可随时移除' : 'Remove it at any time'}</span>
          </div>
        </div>
      </div>
    )
  }
}

/** 创建 Layout Inspector 分组标题栏状态与整体重置操作。 @internal */
export function createLayoutInspectorHeaderActions(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function LayoutInspectorHeaderActions({
    document,
    entity,
    dispatch,
    layoutSnapshot,
    readOnly,
    value,
  }) {
    const zh = useZh()
    const layout = value as ComposeFlexLayout
    const defaults = createDefaultComposeFlexLayout()
    const disabled = readOnly || sameLayout(layout, defaults)
    return (
      <div className="flex-layout-inspector__header-actions">
        <span className="flex-layout-inspector__status">Auto Layout</span>
        <button
          aria-label={zh ? '重置布局' : 'Reset layout'}
          disabled={disabled}
          title={zh ? '重置布局' : 'Reset layout'}
          type="button"
          onClick={() => {
            if (disabled) return
            dispatch(createLayoutCommand(idFactory, entity, defaults, zh, true))
          }}
        >
          <ResetLayoutIcon />
        </button>
        <LayoutActionMenu
          items={[{
            label: zh ? '移除自动布局' : 'Remove auto layout',
            content: zh ? '移除自动布局' : 'Remove auto layout',
            disabled: readOnly || !document || !layoutSnapshot,
            title: !layoutSnapshot
              ? (zh ? '布局结果尚未就绪' : 'Layout result is not ready')
              : undefined,
            onSelect: () => {
              if (!document) return
              const plan = planRemoveComposeAutoLayout(
                document,
                entity.id,
                layoutSnapshot,
                idFactory,
              )
              if (plan.ok) dispatch(plan.command)
            },
          }]}
          menuLabel={zh ? '自动布局操作' : 'Auto layout actions'}
          trigger="⋯"
          triggerLabel={zh ? '更多布局操作' : 'More layout actions'}
        />
      </div>
    )
  }
}

export function createLayoutInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function LayoutInspector({ entity, dispatch, readOnly, value }) {
    const zh = useZh()
    const layout = value as ComposeFlexLayout
    const schema = useMemo(() => v.object({
      flexDirection: v.pipe(
        v.picklist(flexOptionValues('flex-direction')),
        v.title(zh ? '方向' : 'Direction'),
        v.metadata({ propertyPanel: { editor: 'flex-direction' } }),
      ),
      flexWrap: v.pipe(
        v.picklist(flexOptionValues('flex-wrap')),
        v.title(zh ? '换行' : 'Wrap'),
        v.metadata({ propertyPanel: { editor: 'flex-wrap' } }),
      ),
      gap: v.pipe(
        v.object({
          rowGap: v.pipe(v.number(), v.minValue(0)),
          columnGap: v.pipe(v.number(), v.minValue(0)),
        }),
        v.title(zh ? '项间距' : 'Item gap'),
        v.metadata({ propertyPanel: { editor: 'gap' } }),
      ),
      alignContent: v.pipe(
        v.picklist(flexOptionValues('align-content')),
        v.title(zh ? '多行' : 'Content'),
        v.metadata({ propertyPanel: { editor: 'align-content' } }),
      ),
      justifyContent: v.pipe(
        v.picklist(flexOptionValues('justify-content')),
        v.title(zh ? '主轴' : 'Main axis'),
        v.metadata({ propertyPanel: { editor: 'justify-content' } }),
      ),
      alignItems: v.pipe(
        v.picklist(flexOptionValues('align-items')),
        v.title(zh ? '交叉轴' : 'Cross axis'),
        v.metadata({ propertyPanel: { editor: 'align-items' } }),
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
    }), [zh])
    return (
      <div
        aria-label={zh ? '布局属性' : 'Layout properties'}
        className="flex-layout-inspector"
        role="group"
      >
        <FlexDirectionIconContext.Provider value={layout.flexDirection}>
          <ComposePropertyPanel
            readOnly={readOnly}
            renderers={FLEX_RENDERERS}
            schema={schema}
            value={{
              flexDirection: layout.flexDirection,
              flexWrap: layout.flexWrap,
              gap: { rowGap: layout.rowGap, columnGap: layout.columnGap },
              alignContent: layout.alignContent,
              justifyContent: layout.justifyContent,
              alignItems: layout.alignItems,
              padding: layout.padding,
            }}
            onValueChange={(next) => {
              if (readOnly) return
              dispatch(createLayoutCommand(
                idFactory,
                entity,
                {
                  type: 'flex',
                  flexDirection: next.flexDirection,
                  flexWrap: next.flexWrap,
                  rowGap: next.gap.rowGap,
                  columnGap: next.gap.columnGap,
                  padding: next.padding,
                  alignContent: next.alignContent,
                  justifyContent: next.justifyContent,
                  alignItems: next.alignItems,
                },
                zh,
              ))
            }}
          />
        </FlexDirectionIconContext.Provider>
        <FlexLayoutPreview
          layout={layout}
          zh={zh}
        />
      </div>
    )
  }
}
