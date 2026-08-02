import { createContext } from 'react'
import type { ComposeFlexLayout } from '@compose-ui/core'

/** 让枚举图标跟随当前主轴方向旋转。 @internal */
export const FlexDirectionIconContext = createContext<ComposeFlexLayout['flexDirection']>('row')
