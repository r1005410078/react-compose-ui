/**
 * 「布局」分组按 Layout 类型分派 Inspector。
 *
 * @remarks
 * `Layout` 是判别联合，而 Component 定义上只有一个 `inspector` 槽——分派因此发生在这里，
 * 而不是让两种布局各占一个 Component Key。它们回答的是同一个问题（这个容器怎么排它的
 * 子级），共用一个分组、一个标题栏、一个重置按钮；拆成两个 Key 会让用户在面板上同时看见
 * 「布局」与「网格」两组，而其中一组永远是空的。
 * @packageDocumentation
 */

import type { ComponentType } from 'react'
import { isComposeGridLayout, type ComposeLayout } from '@compose-ui/core'
import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'

/**
 * 按 `Layout.type` 在两个 Inspector 之间分派。
 *
 * @param flex - `type: 'flex'` 时渲染
 * @param grid - `type: 'grid'` 时渲染
 * @internal
 */
export function createLayoutInspectorDispatch(
  flex: ComponentType<ComposeComponentInspectorProps>,
  grid: ComponentType<ComposeComponentInspectorProps>,
): ComponentType<ComposeComponentInspectorProps> {
  return function LayoutInspectorDispatch(props: ComposeComponentInspectorProps) {
    const Inspector = isComposeGridLayout(props.value as ComposeLayout) ? grid : flex
    return <Inspector {...props} />
  }
}
