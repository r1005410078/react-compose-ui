import { Component, type ReactNode } from 'react'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  getComposeRenderer,
  type ComposeEntity,
  type EditorCommand,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '../registry/types'
import type { ComposePageDocumentLoader } from '@compose-ui/core'
import type { ComposeNodeEditPort, ComposePaintEditPort } from '../registry/types'

interface BoundaryProps {
  readonly children: ReactNode
  readonly identity: string
  readonly area:
    | 'renderer'
    | 'component-inspector'
    | 'component-inspector-header-actions'
    | 'renderer-inspector'
  /** 定义输入数据；引用变化说明用户可能已修复数据，边界应重试渲染。 */
  readonly resetSignal: unknown
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
    // 文档不可变：数据被命令修改后 resetSignal 引用必然变化。失败后不重试会让
    // 用户在 Inspector 修复坏 props 或 undo 后仍然只看到失败占位。
    if (
      this.state.failed
      && (previous.identity !== this.props.identity
        || previous.resetSignal !== this.props.resetSignal)
    ) {
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
  pageDocumentPort,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly mode: 'editor' | 'preview'
  readonly assetResolver?: ComposeAssetResolver
  readonly pageDocumentPort?: ComposePageDocumentLoader
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
    <DefinitionErrorBoundary area="renderer" identity={renderer.type} resetSignal={renderer}>
      <Renderer
        assetResolver={assetResolver}
        entity={entity}
        mode={mode}
        pageDocumentPort={pageDocumentPort}
        props={renderer.props}
        registry={registry}
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
  nodeEditPort,
  paintEditPort,
  readOnly,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly componentKey: string
  readonly dispatch: (command: EditorCommand) => unknown
  readonly readOnly: boolean
  readonly nodeEditPort?: ComposeNodeEditPort
  readonly paintEditPort?: ComposePaintEditPort
}) {
  const value = entity.components[componentKey]
  const definition = registry.getComponent(componentKey)
  if (!definition) {
    return (
      <div aria-label={`未知 Component ${componentKey}`} role="status">
        未知 Component：{componentKey}
      </div>
    )
  }
  // 定义存在但 Entity 上没有数据：该分组不应展示内容，而不是报告“未知”。
  if (!value) return null
  if (!definition.inspector) return null
  const Inspector = definition.inspector
  return (
    <DefinitionErrorBoundary area="component-inspector" identity={componentKey} resetSignal={value}>
      <Inspector
        componentKey={componentKey}
        dispatch={dispatch}
        entity={entity}
        readOnly={readOnly}
        nodeEditPort={nodeEditPort}
        paintEditPort={paintEditPort}
        value={value}
      />
    </DefinitionErrorBoundary>
  )
}

/** 解析并隔离一个 ECS Component 的可选 Inspector 标题栏内容。 @public */
export function ComposeRegistryComponentInspectorHeaderActions({
  registry,
  entity,
  componentKey,
  dispatch,
  nodeEditPort,
  paintEditPort,
  readOnly,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly componentKey: string
  readonly dispatch: (command: EditorCommand) => unknown
  readonly readOnly: boolean
  readonly nodeEditPort?: ComposeNodeEditPort
  readonly paintEditPort?: ComposePaintEditPort
}) {
  const value = entity.components[componentKey]
  const definition = registry.getComponent(componentKey)
  if (!value || !definition?.inspectorHeaderActions) return null
  const HeaderActions = definition.inspectorHeaderActions
  return (
    <DefinitionErrorBoundary
      area="component-inspector-header-actions"
      identity={componentKey}
      resetSignal={value}
    >
      <HeaderActions
        componentKey={componentKey}
        dispatch={dispatch}
        entity={entity}
        readOnly={readOnly}
        nodeEditPort={nodeEditPort}
        paintEditPort={paintEditPort}
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
  nodeEditPort,
  paintEditPort,
  readOnly,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly dispatch: (command: EditorCommand) => unknown
  readonly readOnly: boolean
  readonly nodeEditPort?: ComposeNodeEditPort
  readonly paintEditPort?: ComposePaintEditPort
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
    <DefinitionErrorBoundary
      area="renderer-inspector"
      identity={renderer.type}
      resetSignal={renderer}
    >
      <Inspector
        dispatch={dispatch}
        entity={entity}
        readOnly={readOnly}
        nodeEditPort={nodeEditPort}
        paintEditPort={paintEditPort}
        renderer={renderer}
      />
    </DefinitionErrorBoundary>
  )
}
