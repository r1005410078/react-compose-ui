import { Component, type ReactNode } from 'react'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  getComposeRenderer,
  type ComposeEntity,
  type EditorCommand,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '../registry/types'

interface BoundaryProps {
  readonly children: ReactNode
  readonly identity: string
  readonly area: 'renderer' | 'component-inspector' | 'renderer-inspector'
}

interface BoundaryState {
  readonly failed: boolean
}

class DefinitionErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (previous.identity !== this.props.identity && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  componentDidCatch() {
    // React 负责报告宿主错误；边界只保证一个 Registry 扩展不会卸载完整消费方。
  }

  render() {
    if (this.state.failed) {
      const label = this.props.area === 'renderer'
        ? '组件渲染失败'
        : '属性检查器失败'
      return (
        <div aria-label={`${label} ${this.props.identity}`} role="status">
          {label}：{this.props.identity}
        </div>
      )
    }
    return this.props.children
  }
}

/** 解析并隔离 Entity 的可选 Renderer；纯容器返回 null。 @public */
export function ComposeRegistryEntityRenderer({
  registry,
  entity,
  mode,
  assetResolver,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly mode: 'editor' | 'preview'
  readonly assetResolver?: ComposeAssetResolver
}) {
  const renderer = getComposeRenderer(entity)
  if (!renderer) return null
  const definition = registry.getRenderer(renderer.type)
  if (!definition) {
    return (
      <div aria-label={`未知 Renderer ${renderer.type}`} role="status">
        未知组件：{renderer.type}
      </div>
    )
  }
  const Renderer = definition.renderer
  return (
    <DefinitionErrorBoundary area="renderer" identity={renderer.type}>
      <Renderer
        assetResolver={assetResolver}
        entity={entity}
        mode={mode}
        props={renderer.props}
        renderer={renderer}
      />
    </DefinitionErrorBoundary>
  )
}

/** 解析并隔离一个 ECS Component 的可选 Inspector。 @public */
export function ComposeRegistryComponentInspector({
  registry,
  entity,
  componentKey,
  dispatch,
  readOnly,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly componentKey: string
  readonly dispatch: (command: EditorCommand) => unknown
  readonly readOnly: boolean
}) {
  const value = entity.components[componentKey]
  const definition = registry.getComponent(componentKey)
  if (!value || !definition) {
    return (
      <div aria-label={`未知能力 ${componentKey}`} role="status">
        未知能力：{componentKey}
      </div>
    )
  }
  if (!definition.inspector) return null
  const Inspector = definition.inspector
  return (
    <DefinitionErrorBoundary area="component-inspector" identity={componentKey}>
      <Inspector
        componentKey={componentKey}
        dispatch={dispatch}
        entity={entity}
        readOnly={readOnly}
        value={value}
      />
    </DefinitionErrorBoundary>
  )
}

/** 解析并隔离 Entity Renderer 的可选内容 Inspector。 @public */
export function ComposeRegistryRendererInspector({
  registry,
  entity,
  dispatch,
  readOnly,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly dispatch: (command: EditorCommand) => unknown
  readonly readOnly: boolean
}) {
  const renderer = getComposeRenderer(entity)
  if (!renderer) return null
  const definition = registry.getRenderer(renderer.type)
  if (!definition) {
    return (
      <div aria-label={`未知 Renderer 属性 ${renderer.type}`} role="status">
        未知组件：{renderer.type}
      </div>
    )
  }
  if (!definition.inspector) return null
  const Inspector = definition.inspector
  return (
    <DefinitionErrorBoundary area="renderer-inspector" identity={renderer.type}>
      <Inspector
        dispatch={dispatch}
        entity={entity}
        readOnly={readOnly}
        renderer={renderer}
      />
    </DefinitionErrorBoundary>
  )
}
