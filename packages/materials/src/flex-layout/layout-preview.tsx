import type { CSSProperties } from 'react'
import type { ComposeFlexLayout } from '@compose-ui/core'

export function FlexLayoutPreview({
  layout,
  zh,
}: {
  readonly layout: ComposeFlexLayout
  readonly zh: boolean
}) {
  const isColumn = layout.flexDirection.startsWith('column')
  const previewStyle: CSSProperties = {
    alignContent: layout.alignContent,
    alignItems: layout.alignItems,
    display: 'flex',
    flexDirection: layout.flexDirection,
    flexWrap: layout.flexWrap,
    rowGap: `${layout.rowGap}px`,
    columnGap: `${layout.columnGap}px`,
    padding: `${layout.padding.top}px ${layout.padding.right}px `
      + `${layout.padding.bottom}px ${layout.padding.left}px`,
    justifyContent: layout.justifyContent,
  }
  const gapStatus = layout.rowGap === layout.columnGap
    ? String(layout.rowGap)
    : `${layout.rowGap}/${layout.columnGap}`
  return (
    <section className="flex-layout-inspector__preview-block">
      <h3>{zh ? '实时预览' : 'Live preview'}</h3>
      <div
        className="flex-layout-inspector__preview"
        data-align-items={layout.alignItems}
        data-flex-direction={layout.flexDirection}
        data-testid="flex-layout-preview"
      >
        <header>
          <span>{zh ? 'Flex 容器' : 'Flex container'}</span>
          <code>
            {layout.flexDirection} · {layout.flexWrap} · gap {gapStatus}
          </code>
        </header>
        <div
          className="flex-layout-inspector__preview-diagram"
        >
          <PreviewAxis
            label={zh ? '主轴' : 'Main axis'}
            orientation={isColumn ? 'vertical' : 'horizontal'}
            testId="flex-preview-main-axis"
          />
          <PreviewAxis
            label={zh ? '交叉轴' : 'Cross axis'}
            orientation={isColumn ? 'horizontal' : 'vertical'}
            testId="flex-preview-cross-axis"
          />
          <div
            aria-hidden="true"
            className="flex-layout-inspector__preview-surface"
            data-wrap-preview={layout.flexWrap !== 'nowrap'}
            style={previewStyle}
          >
            {[1, 2, 3].map((index) => (
              <span data-flex-preview-node="" key={index}>{index}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function PreviewAxis({
  label,
  orientation,
  testId,
}: {
  readonly label: string
  readonly orientation: 'horizontal' | 'vertical'
  readonly testId: string
}) {
  return (
    <div
      className={`flex-layout-inspector__preview-axis is-${orientation}`}
      data-testid={testId}
    >
      {orientation === 'horizontal' ? (
        <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 8">
          <path d="M2 4h96M2 4l4-3M2 4l4 3M98 4l-4-3M98 4l-4 3" />
        </svg>
      ) : (
        <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 8 100">
          <path d="M4 2v96M4 2L1 6M4 2l3 4M4 98l-3-4M4 98l3-4" />
        </svg>
      )}
      <span>{label}</span>
    </div>
  )
}

/** 创建 Layout Component 的紧凑 Flex Inspector。 @internal */
