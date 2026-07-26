import { Component, type ReactNode } from 'react'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComponentInspectorProps, ComponentRegistry } from './types'
import type { ComposeComponentNode } from '@compose-ui/core'

interface BoundaryProps {
  readonly children: ReactNode
  readonly type: string
  readonly area: 'renderer' | 'inspector'
}

interface BoundaryState {
  readonly failed: boolean
}

class DefinitionErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch() {
    // React 负责报告宿主错误；边界只保证一个 definition 不会卸载完整消费方。
  }

  render() {
    if (this.state.failed) {
      const label = this.props.area === 'renderer' ? '组件渲染失败' : '属性检查器失败'
      return (
        <div aria-label={`${label} ${this.props.type}`} role="status">
          {label}：{this.props.type}
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * 解析并隔离渲染一个已注册或未知 Component 节点。
 *
 * @public
 */
export function RegistryComponent({
  registry,
  node,
  mode,
  assetResolver,
}: {
  /** 当前消费方的实例级注册表。 */
  readonly registry: ComponentRegistry
  /** 要渲染的文档节点。 */
  readonly node: ComposeComponentNode
  /** editor 或 preview 渲染模式。 */
  readonly mode: 'editor' | 'preview'
  /** 资源型 renderer 使用的可选解析器。 */
  readonly assetResolver?: ComposeAssetResolver
}) {
  const definition = registry.get(node.componentType)
  if (!definition) {
    return (
      <div aria-label={`未知组件类型 ${node.componentType}`} role="status">
        未知组件：{node.componentType}
      </div>
    )
  }
  const Renderer = definition.renderer
  return (
    <DefinitionErrorBoundary area="renderer" type={node.componentType}>
      <Renderer
        assetResolver={assetResolver}
        mode={mode}
        node={node}
        props={node.props}
      />
    </DefinitionErrorBoundary>
  )
}

/**
 * 解析并隔离一个 definition 的可选 Inspector renderer。
 *
 * @public
 */
export function RegistryInspector({
  registry,
  node,
  dispatch,
}: {
  /** 当前消费方的实例级注册表。 */
  readonly registry: ComponentRegistry
  /** 当前选中的文档 Component。 */
  readonly node: ComposeComponentNode
  /** 统一 TransactionRuntime 命令派发函数。 */
  readonly dispatch: ComponentInspectorProps['dispatch']
}) {
  const definition = registry.get(node.componentType)
  if (!definition) {
    return (
      <div aria-label={`未知组件属性 ${node.componentType}`} role="status">
        未知组件：{node.componentType}
      </div>
    )
  }
  if (!definition.inspector) {
    return (
      <div aria-label={`组件没有属性检查器 ${node.componentType}`} role="status">
        该组件没有属性检查器
      </div>
    )
  }
  const Inspector = definition.inspector
  return (
    <DefinitionErrorBoundary area="inspector" type={node.componentType}>
      <Inspector dispatch={dispatch} node={node} />
    </DefinitionErrorBoundary>
  )
}
