import { useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  ComposePropertyPanel,
  ComposePropertyPanelRoot,
  ComposePropertyPanelSection,
} from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { isComposeFrameEntity } from '@compose-ui/core'
import type { ComposeDocument } from '@compose-ui/core'
import * as v from 'valibot'
import { getEditorMessages } from '../editor-i18n'
import { DefaultEmptyInspector } from './empty-inspector'

/** 页面配置面板的受控属性。 @internal */
export type PageInspectorProps = {
  readonly document: ComposeDocument
  /**
   * 当前激活场景。
   *
   * @remarks
   * 由宿主从 `ComposePageFile.activeFrameId` 注入。缺省表示宿主没有启用页面系统，
   * 此时面板回落为空态提示而不是渲染一个只有标题的空壳。
   */
  readonly activeFrameId?: string | null
  /** 切换激活场景；缺省时选择器只读。 */
  readonly onActiveFrameChange?: (frameId: string) => void
  /** 活动页面的页面脚本 Section（`ComposePropertyPanelSection`）。 */
  readonly pageScriptInspector?: ReactNode
  /** 活动页面的动画 Section（`ComposePropertyPanelSection`）。 */
  readonly animationInspector?: ReactNode
}

type PageInspectorValue = { readonly activeFrameId: string }

/**
 * 没有选择时的页面配置面板。
 *
 * @remarks
 * 它承载的是「这个页面」的属性——激活场景、页面脚本、动画绑定——而**不含页面尺寸**：
 * 尺寸属于场景，在场景自己的 Inspector 里编辑。
 *
 * 页面数据由 `ComposeEditor` 经 `cloneElement` 注入（controller 拿不到页面会话）。
 * 三者都缺省时说明宿主没有页面系统，直接回落到既有空态提示。
 * @internal
 */
export function PageInspector({
  document,
  activeFrameId,
  onActiveFrameChange,
  pageScriptInspector,
  animationInspector,
}: PageInspectorProps) {
  const i18n = useComposeI18nContext()
  const messages = getEditorMessages(
    i18n?.locale ?? 'zh-CN',
    i18n?.formatMessage,
  )
  const frames = useMemo(
    () => document.rootIds.filter((id) => isComposeFrameEntity(document.entities[id])),
    [document],
  )
  const hasPageContext = activeFrameId !== undefined
    || pageScriptInspector !== undefined
    || animationInspector !== undefined
  const schema = useMemo(() => v.object({
    activeFrameId: v.pipe(
      v.picklist(frames.length > 0 ? frames : ['']),
      v.title(messages.pageInspector.activeScene),
      v.metadata({
        propertyPanel: {
          optionLabels: Object.fromEntries(frames.map((id) => [
            id,
            document.entities[id]?.name ?? id,
          ])),
        },
      }),
    ),
  }), [document, frames, messages.pageInspector.activeScene])

  if (!hasPageContext) return <DefaultEmptyInspector />

  const value: PageInspectorValue = {
    activeFrameId: activeFrameId && frames.includes(activeFrameId)
      ? activeFrameId
      : frames[0] ?? '',
  }

  return (
    <ComposePropertyPanelRoot
      aria-label={messages.pageInspector.label}
      className="compose-editor__page-inspector"
      header={{ title: messages.pageInspector.title }}
    >
      <ComposePropertyPanelSection defaultExpanded title={messages.pageInspector.scene}>
        <ComposePropertyPanel
          readOnly={!onActiveFrameChange || frames.length === 0}
          schema={schema}
          value={value}
          onValueChange={(next) => {
            const nextId = (next as PageInspectorValue).activeFrameId
            if (!nextId || nextId === value.activeFrameId) return
            onActiveFrameChange?.(nextId)
          }}
        />
      </ComposePropertyPanelSection>
      {pageScriptInspector}
      {animationInspector}
    </ComposePropertyPanelRoot>
  )
}
