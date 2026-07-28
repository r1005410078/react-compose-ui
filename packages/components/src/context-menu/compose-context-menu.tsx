import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import type {
  ContextMenuCheckboxItemProps as BaseCheckboxItemProps,
  ContextMenuGroupLabelProps as BaseGroupLabelProps,
  ContextMenuGroupProps as BaseGroupProps,
  ContextMenuItemProps as BaseItemProps,
  ContextMenuPopupProps as BasePopupProps,
  ContextMenuRadioGroupProps as BaseRadioGroupProps,
  ContextMenuRadioItemProps as BaseRadioItemProps,
  ContextMenuRootProps as BaseRootProps,
  ContextMenuSubmenuRootProps as BaseSubmenuRootProps,
  ContextMenuSubmenuTriggerProps as BaseSubmenuTriggerProps,
} from '@base-ui/react/context-menu'
import type { SeparatorProps as BaseSeparatorProps } from '@base-ui/react/separator'
import {
  createComposeThemeStyle,
  useComposeI18nContext,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  CSSProperties,
  HTMLAttributes,
} from 'react'
import { cn } from '#lib/utils'

/** 菜单虚拟锚点使用的视口坐标。 */
export interface ComposeContextMenuPoint {
  readonly x: number
  readonly y: number
}

/** React 与原生 `contextmenu` 事件都兼容的最小输入形状。 */
export interface ComposeContextMenuOpenEvent {
  readonly clientX: number
  readonly clientY: number
  readonly currentTarget?: EventTarget | null
  readonly target?: EventTarget | null
  preventDefault?(): void
}

interface ComposeContextMenuRootContextValue {
  readonly anchorPoint: ComposeContextMenuPoint | null
  readonly finalFocus?: BasePopupProps['finalFocus']
  readonly open: boolean
  openAt(point: ComposeContextMenuPoint, trigger: HTMLElement | null): void
}

const ComposeContextMenuRootContext = createContext<ComposeContextMenuRootContextValue | null>(null)

function createPointAnchor(point: ComposeContextMenuPoint) {
  return {
    getBoundingClientRect: () => ({
      bottom: point.y,
      height: 0,
      left: point.x,
      right: point.x,
      top: point.y,
      width: 0,
      x: point.x,
      y: point.y,
    }),
  }
}

/** ContextMenu Root 的 Compose 适配属性。 */
export interface ComposeContextMenuProps extends Omit<BaseRootProps, 'onOpenChange'> {
  /** Hook 打开菜单时使用的虚拟屏幕锚点；未提供时由 Trigger 自动决定。 */
  readonly anchorPoint?: ComposeContextMenuPoint | null
  /** 菜单关闭后由 Popup 调用的焦点恢复策略。 */
  readonly finalFocus?: BasePopupProps['finalFocus']
  /** 菜单可见状态改变后的通知。 */
  readonly onOpenChange?: (open: boolean) => void
}

/**
 * Shadcn/Base UI ContextMenu 的 Compose 命名 Root。
 *
 * @remarks
 * Root 不渲染额外 DOM。Content 会通过 Portal 自行应用 Compose Theme/I18n，避免 Portal 脱离宿主
 * 根节点后丢失 CSS token。
 *
 * @public
 */
export function ComposeContextMenu({
  anchorPoint = null,
  children,
  defaultOpen = false,
  finalFocus,
  onOpenChange,
  open: controlledOpen,
  ...rootProps
}: ComposeContextMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const [triggerAnchorPoint, setTriggerAnchorPoint] = useState<ComposeContextMenuPoint | null>(null)
  const triggerFocusTarget = useRef<HTMLElement | null>(null)
  const open = controlledOpen ?? uncontrolledOpen
  const resolvedAnchorPoint = anchorPoint ?? triggerAnchorPoint

  const setOpen = useCallback((nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [controlledOpen, onOpenChange])

  const fallbackFinalFocus = useCallback(() => triggerFocusTarget.current ?? false, [])
  const openAt = useCallback((point: ComposeContextMenuPoint, trigger: HTMLElement | null) => {
    triggerFocusTarget.current = trigger
    setTriggerAnchorPoint(point)
    setOpen(true)
  }, [setOpen])

  const contextValue = useMemo(
    () => ({
      anchorPoint: resolvedAnchorPoint,
      finalFocus: finalFocus ?? fallbackFinalFocus,
      open,
      openAt,
    }),
    [fallbackFinalFocus, finalFocus, open, openAt, resolvedAnchorPoint],
  )
  return (
    <ComposeContextMenuRootContext.Provider value={contextValue}>
      <MenuPrimitive.Root
        {...rootProps}
        modal={false}
        onOpenChange={(nextOpen) => setOpen(nextOpen)}
        open={open}
      >
        {children}
      </MenuPrimitive.Root>
    </ComposeContextMenuRootContext.Provider>
  )
}

/** 右键或长按触发区域的标准 div 属性。 */
export type ComposeContextMenuTriggerProps = HTMLAttributes<HTMLDivElement>

/** Shadcn/Base UI Trigger 的 Compose 命名适配。 */
export const ComposeContextMenuTrigger = forwardRef<HTMLDivElement, ComposeContextMenuTriggerProps>(
  function ComposeContextMenuTrigger({ className, ...triggerProps }, ref) {
    const rootContext = useContext(ComposeContextMenuRootContext)
    if (!rootContext) {
      throw new Error('ComposeContextMenuTrigger must be rendered inside ComposeContextMenu.')
    }
    return (
      <div
        {...triggerProps}
        ref={ref}
        className={cn('cu:select-none', className)}
        data-compose-ui="context-menu-trigger"
        onContextMenu={(event) => {
          triggerProps.onContextMenu?.(event)
          event.preventDefault()
          rootContext.openAt({ x: event.clientX, y: event.clientY }, event.currentTarget)
        }}
      />
    )
  },
)

/** Content 的定位与 Popup 属性。 */
export interface ComposeContextMenuContentProps extends BasePopupProps {
  readonly align?: 'center' | 'end' | 'start'
  readonly alignOffset?: number
  readonly collisionPadding?: number
  readonly side?: 'bottom' | 'left' | 'right' | 'top'
  readonly sideOffset?: number
}

function ComposeContextMenuSurface({
  align = 'start',
  alignOffset,
  children,
  className,
  collisionPadding = 8,
  finalFocus,
  isSubmenu = false,
  side,
  sideOffset = 2,
  style,
  ...popupProps
}: ComposeContextMenuContentProps & { readonly isSubmenu?: boolean }) {
  const rootContext = useContext(ComposeContextMenuRootContext)
  if (!rootContext) {
    throw new Error('ComposeContextMenuContent must be rendered inside ComposeContextMenu.')
  }
  const theme = useComposeThemeContext()
  const i18n = useComposeI18nContext()
  const popupRef = useRef<HTMLDivElement>(null)
  const anchor = useMemo(
    () => isSubmenu || !rootContext.anchorPoint ? undefined : createPointAnchor(rootContext.anchorPoint),
    [isSubmenu, rootContext.anchorPoint],
  )

  const setPopupRef = useCallback((node: HTMLDivElement | null) => {
    popupRef.current = node
    if (!node || isSubmenu || !rootContext.open) return
    // Base UI 会在下一动画帧完成自身的初始焦点处理；这里先在 ref commit 阶段同步定位第一个
    // 可用项，保证紧随右键事件到达的方向键不会先落在 body。随后 Base UI 的 roving focus 仍接管。
    node.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus()
  }, [isSubmenu, rootContext.open])

  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        collisionPadding={collisionPadding}
        positionMethod="fixed"
        side={isSubmenu ? side : side ?? 'bottom'}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          {...popupProps}
          className={cn(
            'cu:z-50 cu:min-w-44 cu:overflow-hidden cu:rounded-md cu:border cu:border-border cu:bg-popover cu:p-1 cu:text-popover-foreground cu:shadow-lg cu:outline-none cu:data-[ending-style]:opacity-0',
            className,
          )}
          data-compose-theme={theme?.resolvedTheme}
          data-compose-ui="context-menu"
          data-slot="context-menu-content"
          finalFocus={finalFocus ?? rootContext.finalFocus}
          lang={i18n?.locale ?? 'zh-CN'}
          ref={setPopupRef}
          style={{
            ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
            ...style,
          } as CSSProperties}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

/**
 * 通过 Portal 显示、自动避让视口边界的共享菜单内容。
 *
 * @public
 */
export function ComposeContextMenuContent(props: ComposeContextMenuContentProps) {
  return <ComposeContextMenuSurface {...props} />
}

/** ContextMenu Item 的视觉语义。 */
export type ComposeContextMenuItemVariant = 'default' | 'destructive'

/** Shadcn/Base UI Item 的 Compose 命名属性。 */
export interface ComposeContextMenuItemProps extends Omit<BaseItemProps, 'render'> {
  /** 删除等不可逆操作使用 destructive 语义色。 */
  readonly variant?: ComposeContextMenuItemVariant
}

/** 通用菜单项，默认渲染为可禁用的原生 button。 */
export const ComposeContextMenuItem = forwardRef<HTMLElement, ComposeContextMenuItemProps>(
  function ComposeContextMenuItem({ className, variant = 'default', ...itemProps }, ref) {
    return (
      <MenuPrimitive.Item
        {...itemProps}
        ref={ref}
        className={cn(
          'cu:relative cu:flex cu:w-full cu:cursor-default cu:items-center cu:gap-2 cu:rounded-sm cu:px-2 cu:py-1.5 cu:text-left cu:text-sm cu:outline-hidden cu:select-none cu:data-[highlighted]:bg-accent cu:data-[highlighted]:text-accent-foreground cu:data-[disabled]:pointer-events-none cu:data-[disabled]:opacity-50',
          variant === 'destructive' && 'cu:text-destructive cu:data-[highlighted]:bg-destructive/15 cu:data-[highlighted]:text-destructive',
          className,
        )}
        data-danger={variant === 'destructive' ? 'true' : undefined}
        data-slot="context-menu-item"
      />
    )
  },
)

/** 菜单分隔线的属性。 */
export type ComposeContextMenuSeparatorProps = BaseSeparatorProps

/** 菜单分隔线。 */
export const ComposeContextMenuSeparator = forwardRef<HTMLDivElement, ComposeContextMenuSeparatorProps>(
  function ComposeContextMenuSeparator({ className, ...separatorProps }, ref) {
    return (
      <MenuPrimitive.Separator
        {...separatorProps}
        ref={ref}
        className={cn('cu:-mx-1 cu:my-1 cu:h-px cu:bg-border', className)}
        data-slot="context-menu-separator"
      />
    )
  },
)

/** 语义相关菜单项分组的属性。 */
export type ComposeContextMenuGroupProps = BaseGroupProps

/** 语义相关菜单项的分组容器。 */
export const ComposeContextMenuGroup = forwardRef<HTMLDivElement, ComposeContextMenuGroupProps>(
  function ComposeContextMenuGroup({ className, ...groupProps }, ref) {
    return <MenuPrimitive.Group {...groupProps} ref={ref} className={cn(className)} data-slot="context-menu-group" />
  },
)

/** 分组可访问标签的属性。 */
export type ComposeContextMenuLabelProps = BaseGroupLabelProps

/** 分组的可访问标签。 */
export const ComposeContextMenuLabel = forwardRef<HTMLDivElement, ComposeContextMenuLabelProps>(
  function ComposeContextMenuLabel({ className, ...labelProps }, ref) {
    return (
      <MenuPrimitive.GroupLabel
        {...labelProps}
        ref={ref}
        className={cn('cu:px-2 cu:py-1.5 cu:text-xs cu:font-medium cu:text-muted-foreground', className)}
        data-slot="context-menu-label"
      />
    )
  },
)

/** 菜单项末尾快捷键提示的属性。 */
export type ComposeContextMenuShortcutProps = HTMLAttributes<HTMLSpanElement>

/** 菜单项末尾的快捷键提示。 */
export function ComposeContextMenuShortcut({ className, ...shortcutProps }: ComposeContextMenuShortcutProps) {
  return (
    <span
      {...shortcutProps}
      className={cn('cu:ml-auto cu:text-xs cu:tracking-widest cu:text-muted-foreground', className)}
      data-slot="context-menu-shortcut"
    />
  )
}

/** Shadcn/Base UI Checkbox Item 的 Compose 命名属性。 */
export type ComposeContextMenuCheckboxItemProps = Omit<BaseCheckboxItemProps, 'render'>

/** 带内置勾选指示器的菜单复选项。 */
export const ComposeContextMenuCheckboxItem = forwardRef<HTMLElement, ComposeContextMenuCheckboxItemProps>(
  function ComposeContextMenuCheckboxItem({ children, className, ...itemProps }, ref) {
    return (
      <MenuPrimitive.CheckboxItem
        {...itemProps}
        ref={ref}
        className={cn(
          'cu:relative cu:flex cu:w-full cu:cursor-default cu:items-center cu:gap-2 cu:rounded-sm cu:py-1.5 cu:pr-2 cu:pl-8 cu:text-left cu:text-sm cu:outline-hidden cu:select-none cu:data-[highlighted]:bg-accent cu:data-[highlighted]:text-accent-foreground cu:data-[disabled]:pointer-events-none cu:data-[disabled]:opacity-50',
          className,
        )}
        data-slot="context-menu-checkbox-item"
      >
        <span className="cu:absolute cu:left-2 cu:grid cu:size-3.5 cu:place-items-center" data-slot="context-menu-checkbox-indicator">
          <MenuPrimitive.CheckboxItemIndicator>✓</MenuPrimitive.CheckboxItemIndicator>
        </span>
        {children}
      </MenuPrimitive.CheckboxItem>
    )
  },
)

/** Shadcn/Base UI Radio Group 的 Compose 命名属性。 */
export type ComposeContextMenuRadioGroupProps = BaseRadioGroupProps

/** 菜单单选项分组。 */
export const ComposeContextMenuRadioGroup = MenuPrimitive.RadioGroup

/** Shadcn/Base UI Radio Item 的 Compose 命名属性。 */
export type ComposeContextMenuRadioItemProps = Omit<BaseRadioItemProps, 'render'>

/** 带内置圆点指示器的菜单单选项。 */
export const ComposeContextMenuRadioItem = forwardRef<HTMLElement, ComposeContextMenuRadioItemProps>(
  function ComposeContextMenuRadioItem({ children, className, ...itemProps }, ref) {
    return (
      <MenuPrimitive.RadioItem
        {...itemProps}
        ref={ref}
        className={cn(
          'cu:relative cu:flex cu:w-full cu:cursor-default cu:items-center cu:gap-2 cu:rounded-sm cu:py-1.5 cu:pr-2 cu:pl-8 cu:text-left cu:text-sm cu:outline-hidden cu:select-none cu:data-[highlighted]:bg-accent cu:data-[highlighted]:text-accent-foreground cu:data-[disabled]:pointer-events-none cu:data-[disabled]:opacity-50',
          className,
        )}
        data-slot="context-menu-radio-item"
      >
        <span className="cu:absolute cu:left-2 cu:grid cu:size-3.5 cu:place-items-center" data-slot="context-menu-radio-indicator">
          <MenuPrimitive.RadioItemIndicator>●</MenuPrimitive.RadioItemIndicator>
        </span>
        {children}
      </MenuPrimitive.RadioItem>
    )
  },
)

/** Shadcn/Base UI Submenu Root 的 Compose 命名属性。 */
export type ComposeContextMenuSubProps = BaseSubmenuRootProps

/** 嵌套 ContextMenu 的 Root。 */
export const ComposeContextMenuSub = MenuPrimitive.SubmenuRoot

/** Shadcn/Base UI Submenu Trigger 的 Compose 命名属性。 */
export type ComposeContextMenuSubTriggerProps = Omit<BaseSubmenuTriggerProps, 'render'>

/** 打开嵌套菜单的触发项。 */
export const ComposeContextMenuSubTrigger = forwardRef<HTMLElement, ComposeContextMenuSubTriggerProps>(
  function ComposeContextMenuSubTrigger({ children, className, ...triggerProps }, ref) {
    return (
      <MenuPrimitive.SubmenuTrigger
        {...triggerProps}
        ref={ref}
        className={cn(
          'cu:flex cu:w-full cu:cursor-default cu:items-center cu:rounded-sm cu:px-2 cu:py-1.5 cu:text-left cu:text-sm cu:outline-hidden cu:select-none cu:data-[highlighted]:bg-accent cu:data-[highlighted]:text-accent-foreground cu:data-[disabled]:pointer-events-none cu:data-[disabled]:opacity-50',
          className,
        )}
        data-slot="context-menu-sub-trigger"
      >
        {children}<span aria-hidden="true" className="cu:ml-auto cu:text-muted-foreground">›</span>
      </MenuPrimitive.SubmenuTrigger>
    )
  },
)

/** 子菜单内容的属性。 */
export type ComposeContextMenuSubContentProps = Omit<ComposeContextMenuContentProps, 'finalFocus'>

/** 子菜单的 Portal 内容。 */
export function ComposeContextMenuSubContent(props: ComposeContextMenuSubContentProps) {
  return <ComposeContextMenuSurface {...props} isSubmenu />
}

/** Hook 传给 ContextMenu Root 的受控属性。 */
export type ComposeContextMenuRootProps = Pick<
  ComposeContextMenuProps,
  'anchorPoint' | 'finalFocus' | 'onOpenChange' | 'open'
>

/** 运行时右键菜单的实例控制器。 */
export interface ComposeContextMenuController<T> {
  readonly anchorPoint: ComposeContextMenuPoint | null
  readonly open: boolean
  readonly payload: T | null
  readonly rootProps: ComposeContextMenuRootProps
  /** 关闭菜单并清除当前 payload 与虚拟锚点。 */
  close(): void
  /** 从原生/React 右键事件或显式屏幕坐标打开菜单。 */
  openAt(eventOrPoint: ComposeContextMenuOpenEvent | ComposeContextMenuPoint, payload: T): void
}

function isContextMenuEvent(
  eventOrPoint: ComposeContextMenuOpenEvent | ComposeContextMenuPoint,
): eventOrPoint is ComposeContextMenuOpenEvent {
  return 'preventDefault' in eventOrPoint || 'target' in eventOrPoint || 'currentTarget' in eventOrPoint
}

function resolveFocusTarget(event: ComposeContextMenuOpenEvent) {
  const direct = event.currentTarget
  if (direct instanceof HTMLElement && direct.tabIndex >= 0) return direct
  const target = event.target
  if (!(target instanceof HTMLElement)) return null
  const focusable = target.closest<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )
  return focusable ?? (target.tabIndex >= 0 ? target : null)
}

/**
 * 管理运行时坐标、payload 与关闭焦点恢复的右键菜单状态。
 *
 * @remarks
 * 虚拟化行和 DOM 委托事件不需要额外包装 Trigger；它们先完成领域选择或权限判断，再调用 `openAt`。
 * 简单静态区域仍应优先使用声明式 `ComposeContextMenuTrigger`。
 *
 * @public
 */
export function useComposeContextMenu<T>(): ComposeContextMenuController<T> {
  const [anchorPoint, setAnchorPoint] = useState<ComposeContextMenuPoint | null>(null)
  const [open, setOpen] = useState(false)
  const [payload, setPayload] = useState<T | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setAnchorPoint(null)
    setPayload(null)
  }, [])

  const openAt = useCallback((eventOrPoint: ComposeContextMenuOpenEvent | ComposeContextMenuPoint, nextPayload: T) => {
    const point: ComposeContextMenuPoint = isContextMenuEvent(eventOrPoint)
      ? { x: eventOrPoint.clientX, y: eventOrPoint.clientY }
      : eventOrPoint
    if (isContextMenuEvent(eventOrPoint)) {
      eventOrPoint.preventDefault?.()
      returnFocusRef.current = resolveFocusTarget(eventOrPoint)
    }
    setAnchorPoint(point)
    setPayload(nextPayload)
    setOpen(true)
  }, [])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) close()
    else setOpen(true)
  }, [close])

  const finalFocus = useCallback(() => {
    const target = returnFocusRef.current
    if (target?.isConnected) return target
    return false
  }, [])

  const rootProps = useMemo<ComposeContextMenuRootProps>(() => ({
    anchorPoint,
    finalFocus,
    onOpenChange: handleOpenChange,
    open,
  }), [anchorPoint, finalFocus, handleOpenChange, open])

  return { anchorPoint, close, open, openAt, payload, rootProps }
}
