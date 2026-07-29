import { createContext, useContext } from 'react'

/** Paint 语义 editor 与宿主编辑会话之间的可选桥接。 @public */
export interface ComposePropertyPanelPaintEditorPort {
  /** 填充 Popover 打开或关闭时通知宿主。 */
  readonly onOpenChange?: (open: boolean) => void
  /** 原生吸管不可用时请求宿主开始画布图层取色。 */
  readonly onEyedropperFallback?: () => void
}

/** 纯色语义 editor 与宿主取色会话之间的可选桥接。 @public */
export interface ComposePropertyPanelColorEditorPort {
  /** 原生吸管不可用时请求宿主开始画布图层取色。 */
  readonly onEyedropperFallback?: () => void
}

/** Property Panel 内部注入的编辑端口集合。 @internal */
export interface PropertyPanelEditorPorts {
  readonly color?: ComposePropertyPanelColorEditorPort
  readonly paint?: ComposePropertyPanelPaintEditorPort
}

/** 编辑端口只在当前 Property Panel 子树内生效，避免将 Stage 依赖泄漏进字段模型。 @internal */
export const PropertyPanelEditorPortsContext = createContext<PropertyPanelEditorPorts>({})

/** 读取当前属性面板注入的 Paint 编辑端口。 @public */
export function useComposePropertyPanelPaintEditorPort(): ComposePropertyPanelPaintEditorPort | undefined {
  return useContext(PropertyPanelEditorPortsContext).paint
}

/** 读取当前属性面板注入的纯色取色端口。 @public */
export function useComposePropertyPanelColorEditorPort(): ComposePropertyPanelColorEditorPort | undefined {
  return useContext(PropertyPanelEditorPortsContext).color
}
