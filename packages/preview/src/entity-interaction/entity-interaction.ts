import {
  resolveComposeInteractionAction,
  type ComposeEntity,
  type ComposeInteractionAction,
  type ComposeNavigationPort,
} from '@compose-ui/core'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * 一个可交互 Entity 在预览中需要的 DOM 属性。
 *
 * @remarks
 * 刻意只返回属性而不是包一层元素：Entity 的容器 div 已经承载几何，多包一层会在
 * 绝对定位链里插入一个不该存在的盒子。
 * @public
 */
export interface ComposeEntityInteractionProps {
  readonly role?: 'button'
  readonly tabIndex?: number
  readonly 'aria-label'?: string
  readonly onClick?: () => void
  readonly onKeyDown?: (event: ReactKeyboardEvent<HTMLElement>) => void
  readonly 'data-compose-interaction'?: string
}

const EMPTY_INTERACTION_PROPS: ComposeEntityInteractionProps = {}

/** 激活可交互 Entity 的按键；与原生 button 保持一致。 */
const ACTIVATION_KEYS = new Set(['Enter', ' ', 'Spacebar'])

function runAction(action: ComposeInteractionAction, navigation: ComposeNavigationPort) {
  if (action.type === 'navigate') {
    // 目标还没选：这条交互是编辑期的半成品，运行期什么都不做。
    if (action.target === null) return
    void navigation.navigate(action.target, action.params)
    return
  }
  void navigation.back()
}

/**
 * 由 Entity 的 `Interaction` 派生预览中的交互属性。
 *
 * @remarks
 * 处理器挂在 Entity 自己的容器上且**不调用** `stopPropagation`：容器是物料的祖先，
 * 点击先到达物料、再冒泡到容器，因此物料自身绑定的页面方法与容器的跳转都会执行。
 * 主动阻断会让"给一个内含按钮的卡片配跳转"变成二选一。
 *
 * 带交互的 Entity 取得 `role="button"` 与可访问名称。名称取 Entity 名——它由用户在
 * 场景树里命名，是这里唯一可用的人类可读标识。
 *
 * @param entity - 待渲染的 Entity；没有 `Interaction` 时返回空属性。
 * @param navigation - 宿主导航端口；缺省时返回空属性，独立 Preview 因此不会凭空多出按钮语义。
 * @public
 */
export function composeEntityInteractionProps(
  entity: ComposeEntity | undefined,
  navigation: ComposeNavigationPort | undefined,
): ComposeEntityInteractionProps {
  if (!navigation) return EMPTY_INTERACTION_PROPS
  const action = resolveComposeInteractionAction(entity, 'click')
  if (!action) return EMPTY_INTERACTION_PROPS
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': entity?.name,
    'data-compose-interaction': action.type,
    onClick: () => { runAction(action, navigation) },
    onKeyDown: (event) => {
      if (!ACTIVATION_KEYS.has(event.key)) return
      // 空格默认滚动页面；交给键盘用户激活之前必须先拦下默认行为。
      event.preventDefault()
      runAction(action, navigation)
    },
  }
}
