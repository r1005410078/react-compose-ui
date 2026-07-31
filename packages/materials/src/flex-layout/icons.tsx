import type { ReactNode } from 'react'
import type {
  ComposeAlignContent,
  ComposeAlignItems,
  ComposeFlexDirection,
  ComposeFlexWrap,
  ComposeJustifyContent,
} from '@compose-ui/core'

interface FlexLayoutIconProps {
  readonly editor:
    | 'flex-direction'
    | 'flex-wrap'
    | 'align-content'
    | 'justify-content'
    | 'align-items'
  readonly flexDirection: ComposeFlexDirection
  readonly value: string
}

interface BrowserFlexIconProps {
  readonly children: ReactNode
  readonly name: string
  readonly rotate?: number
  readonly scaleX?: number
  readonly scaleY?: number
}

/**
 * 统一使用浏览器 DevTools 的 20px 图标坐标系，避免不同属性组出现视觉大小漂移。
 */
function BrowserFlexIcon({
  children,
  name,
  rotate = 0,
  scaleX = 1,
  scaleY = 1,
}: BrowserFlexIconProps) {
  const transform = [
    'translate(10 10)',
    rotate === 0 ? '' : `rotate(${rotate})`,
    scaleX === 1 && scaleY === 1 ? '' : `scale(${scaleX} ${scaleY})`,
    'translate(-10 -10)',
  ].filter(Boolean).join(' ')
  return (
    <svg
      aria-hidden="true"
      data-flex-layout-icon={name}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <g transform={transform}>{children}</g>
    </svg>
  )
}

function directionTransform(value: ComposeFlexDirection) {
  switch (value) {
    case 'row': return { rotate: -90, scaleX: -1, scaleY: 1 }
    case 'column': return { rotate: 0, scaleX: 1, scaleY: 1 }
    case 'row-reverse': return { rotate: 90, scaleX: 1, scaleY: 1 }
    case 'column-reverse': return { rotate: 0, scaleX: 1, scaleY: -1 }
  }
}

function DirectionIcon({ value }: { readonly value: ComposeFlexDirection }) {
  const transform = directionTransform(value)
  return (
    <BrowserFlexIcon name={`direction-${value}`} {...transform}>
      <path
        clipRule="evenodd"
        d="M2 9V3h8v6H2Zm1.5-4.5v3h5v-3h-5Z"
        fillRule="evenodd"
      />
      <path d="M10 11H2v6h8v-6Z" />
      <path d="M14.25 14.19V3h1.5v11.19l1.72-1.72 1.06 1.06L15 17.06l-3.53-3.53 1.06-1.06 1.72 1.72Z" />
    </BrowserFlexIcon>
  )
}

function NoWrapPaths() {
  return (
    <>
      <path clipRule="evenodd" d="M4 6.5H2.5v6H4v-6ZM1 5v9h4.5V5H1Z" fillRule="evenodd" />
      <path d="M7.75 5h4.5v9h-4.5V5Z" />
      <path clipRule="evenodd" d="M17.5 6.5H16v6h1.5v-6ZM14.5 5v9H19V5h-4.5Z" fillRule="evenodd" />
    </>
  )
}

function WrapPaths() {
  return (
    <>
      <path clipRule="evenodd" d="M4 3.5H2.5v4H4v-4ZM1 2v7h4.5V2H1Z" fillRule="evenodd" />
      <path d="M1 11h4.5v7H1v-7Z" />
      <path clipRule="evenodd" d="M17.5 3.5H16v4h1.5v-4ZM14.5 2v7H19V2h-4.5Z" fillRule="evenodd" />
      <path d="M7.75 2h4.5v7h-4.5V2Z" />
      <path clipRule="evenodd" d="M10.75 12.5h-1.5v4h1.5v-4ZM7.75 11v7h4.5v-7h-4.5Z" fillRule="evenodd" />
      <path d="M14.5 11H19v7h-4.5v-7Z" />
    </>
  )
}

function WrapIcon({
  direction,
  value,
}: {
  readonly direction: ComposeFlexDirection
  readonly value: ComposeFlexWrap
}) {
  const vertical = direction.startsWith('column')
  return (
    <BrowserFlexIcon
      name={`wrap-${value}`}
      rotate={vertical ? 90 : 0}
      scaleY={value === 'wrap-reverse' ? -1 : 1}
    >
      {value === 'nowrap' ? <NoWrapPaths /> : <WrapPaths />}
    </BrowserFlexIcon>
  )
}

function AlignContentPaths({ value }: { readonly value: ComposeAlignContent }) {
  switch (value) {
    case 'center': return (
      <>
        <path clipRule="evenodd" d="M18 10.75H2v-1.5h16v1.5Z" fillRule="evenodd" />
        <path d="M6 4h8v3H6V4ZM6 13h8v3H6v-3Z" />
      </>
    )
    case 'flex-start': return (
      <>
        <path clipRule="evenodd" d="M18 3.5H2V2h16v1.5Z" fillRule="evenodd" />
        <path d="M6 6h8v3H6V6ZM6 11h8v3H6v-3Z" />
      </>
    )
    case 'flex-end': return (
      <>
        <path clipRule="evenodd" d="M18 18H2v-1.5h16V18Z" fillRule="evenodd" />
        <path d="M6 6h8v3H6V6ZM6 11h8v3H6v-3Z" />
      </>
    )
    case 'space-around': return (
      <>
        <path clipRule="evenodd" d="M18 18H2v-1.5h16V18ZM18 3.5H2V2h16v1.5Z" fillRule="evenodd" />
        <path d="M6 5h8v3H6V5ZM6 12h8v3H6v-3Z" />
      </>
    )
    case 'space-between': return (
      <>
        <path d="M14 3.5h4V2H2v1.5h4v3h8v-3ZM2 18h16v-1.5h-4v-3H6v3H2V18Z" />
      </>
    )
    case 'normal':
    case 'stretch': return (
      <path d="M2 3.5h4V9h8V3.5h4V2H2v1.5ZM2 18h16v-1.5h-4V11H6v5.5H2V18Z" />
    )
  }
}

function AlignContentIcon({
  direction,
  value,
}: {
  readonly direction: ComposeFlexDirection
  readonly value: ComposeAlignContent
}) {
  return (
    <BrowserFlexIcon
      name={`align-content-${value}`}
      rotate={direction.startsWith('column') ? -90 : 0}
    >
      <AlignContentPaths value={value} />
    </BrowserFlexIcon>
  )
}

function JustifyContentPaths({ value }: { readonly value: ComposeJustifyContent }) {
  switch (value) {
    case 'center': return (
      <>
        <path clipRule="evenodd" d="M9.25 18V2h1.5v16h-1.5Z" fillRule="evenodd" />
        <path d="M13 6h3v8h-3V6ZM4 6h3v8H4V6Z" />
      </>
    )
    case 'normal':
    case 'flex-start': return (
      <>
        <path clipRule="evenodd" d="M2 2v16h1.5V2H2Z" fillRule="evenodd" />
        <path d="M14 14V6h-3v8h3ZM9 14V6H6v8h3Z" />
      </>
    )
    case 'flex-end': return (
      <>
        <path d="M18 2v16h-1.5V2H18ZM6 14V6h3v8H6ZM11 6v8h3V6h-3Z" />
      </>
    )
    case 'space-between': return (
      <path d="M3.5 18v-4h3V6h-3V2H2v16h1.5ZM18 18V2h-1.5v4h-3v8h3v4H18Z" />
    )
    case 'space-around': return (
      <path d="M3.5 18V2H2v16h1.5ZM18 18V2h-1.5v16H18ZM5 14V6h3v8H5ZM12 6v8h3V6h-3Z" />
    )
    case 'space-evenly': return (
      <path d="M3.5 18V2H2v16h1.5ZM18 18V2h-1.5v16H18ZM6 14V6h3v8H6ZM11 6v8h3V6h-3Z" />
    )
  }
}

function JustifyIcon({
  direction,
  value,
}: {
  readonly direction: ComposeFlexDirection
  readonly value: ComposeJustifyContent
}) {
  const vertical = direction.startsWith('column')
  return (
    <BrowserFlexIcon
      name={`justify-content-${value}`}
      rotate={vertical ? (direction.endsWith('reverse') ? -90 : 90) : 0}
      scaleX={!vertical && direction.endsWith('reverse') ? -1 : 1}
    >
      <JustifyContentPaths value={value} />
    </BrowserFlexIcon>
  )
}

function AlignItemsPaths({ value }: { readonly value: ComposeAlignItems }) {
  switch (value) {
    case 'center': return (
      <>
        <path clipRule="evenodd" d="M18 10.75H2v-1.5h16v1.5Z" fillRule="evenodd" />
        <path d="M9 3v14H6V3h3ZM15 6v8h-3V6h3Z" />
      </>
    )
    case 'flex-start': return (
      <path d="M2 3.5h16V2H2v1.5ZM6 5v11h3V5H6ZM11 12V5h3v7h-3Z" />
    )
    case 'flex-end': return (
      <path d="M2 16.5h16V18H2v-1.5ZM6 15V4h3v11H6ZM11 8v7h3V8h-3Z" />
    )
    case 'normal':
    case 'stretch': return (
      <path d="M18 16.5H2V18h16v-1.5ZM18 2H2v1.5h16V2ZM6 15V5h3v10H6ZM11 5v10h3V5h-3Z" />
    )
    case 'baseline': return (
      <>
        <path clipRule="evenodd" d="M9.1 4 5.35 14h1.73L8 11.44h4.04l.88 2.56h1.73L10.9 4H9.1Zm2.4 6H8.52l1.44-4.15h.08L11.5 10Z" fillRule="evenodd" />
        <path d="M18 16.5H2V18h16v-1.5Z" />
      </>
    )
  }
}

function AlignItemsIcon({
  direction,
  value,
}: {
  readonly direction: ComposeFlexDirection
  readonly value: ComposeAlignItems
}) {
  return (
    <BrowserFlexIcon
      name={`align-items-${value}`}
      rotate={value !== 'baseline' && direction.startsWith('column') ? -90 : 0}
    >
      <AlignItemsPaths value={value} />
    </BrowserFlexIcon>
  )
}

/** Flex 图标 editor 使用的浏览器一致紧凑示意图。 @internal */
export function FlexLayoutIcon({ editor, flexDirection, value }: FlexLayoutIconProps) {
  switch (editor) {
    case 'flex-direction':
      return <DirectionIcon value={value as ComposeFlexDirection} />
    case 'flex-wrap':
      return <WrapIcon direction={flexDirection} value={value as ComposeFlexWrap} />
    case 'align-content':
      return <AlignContentIcon direction={flexDirection} value={value as ComposeAlignContent} />
    case 'justify-content':
      return <JustifyIcon direction={flexDirection} value={value as ComposeJustifyContent} />
    case 'align-items':
      return <AlignItemsIcon direction={flexDirection} value={value as ComposeAlignItems} />
  }
}
