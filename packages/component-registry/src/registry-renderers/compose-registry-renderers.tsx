import { Component, type ReactNode, useEffect, useReducer } from 'react'
import type { ComposeAssetResolver } from '@compose-ui/assets'
import {
  getComposeBindings,
  getComposeRenderer,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type EditorCommand,
} from '@compose-ui/core'
import type { ComposePageScriptScope, ComposeScriptModuleLoader } from '@compose-ui/script-runtime'
import { resolveComposeRendererRuntimeProps } from '../registry/runtime-props'
import type { ComposeEntityRegistry, ComposeRendererTextEditing } from '../registry/types'
import type { ComposePageDocumentLoader } from '@compose-ui/core'
import type {
  ComposeNodeEditPort,
  ComposePaintEditPort,
  ComposeRendererInspectorBindingPort,
  ComposeRendererPropCategory,
} from '../registry/types'

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
  scriptScope,
  scriptModuleLoader,
  textEditing,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly mode: 'editor' | 'preview'
  readonly assetResolver?: ComposeAssetResolver
  readonly pageDocumentPort?: ComposePageDocumentLoader
  /** 当前页面渲染实例的可选 setup 返回作用域。 */
  readonly scriptScope?: ComposePageScriptScope
  readonly scriptModuleLoader?: ComposeScriptModuleLoader
  /** 宿主请求的原地文字编辑态；只在编辑 Stage 传入。 */
  readonly textEditing?: ComposeRendererTextEditing
}) {
  const [, refreshBindings] = useReducer((revision: number) => revision + 1, 0)
  const bindings = getComposeBindings(entity)
  useEffect(() => {
    if (!scriptScope || !bindings) return undefined
    const references = Object.values(bindings.rendererProps.fields)
    const unsubscribers = [...new Set(
      references.map(({ exportName }) => exportName),
    )].map((exportName) => scriptScope.subscribeExport(exportName, refreshBindings))
    return () => { unsubscribers.forEach((unsubscribe) => { unsubscribe() }) }
  }, [bindings, scriptScope])

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
  const resolved = resolveComposeRendererRuntimeProps({
    entity,
    definition,
    scope: scriptScope,
    methodMode: mode === 'editor' ? 'noop' : 'invoke',
  })
  // Preview 是只读渲染入口，不能继承编辑态；未声明契约的 Renderer 也无处安放编辑的文本。
  const editablePropName = definition.editableTextPropName
  const activeTextEditing = mode === 'editor' && editablePropName !== undefined
    ? textEditing
    : undefined
  // 编辑中的值经 props 抵达 Renderer，物料照常渲染那个 Prop 即可与最终排版同源；
  // authoredProps 保持文档原值，它的语义是「已经写进文档的值」。
  const props = activeTextEditing
    ? { ...resolved.props, [editablePropName!]: activeTextEditing.value }
    : resolved.props
  return (
    <DefinitionErrorBoundary area="renderer" identity={renderer.type} resetSignal={renderer}>
      <Renderer
        assetResolver={assetResolver}
        authoredProps={resolved.authoredProps}
        entity={entity}
        mode={mode}
        pageDocumentPort={pageDocumentPort}
        props={props}
        registry={registry}
        renderer={renderer}
        scriptModuleLoader={scriptModuleLoader}
        textEditing={activeTextEditing}
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
  document,
  layoutSnapshot,
  nodeEditPort,
  paintEditPort,
  readOnly,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly componentKey: string
  readonly dispatch: (command: EditorCommand) => unknown
  readonly document?: ComposeDocument
  readonly layoutSnapshot?: ComposeLayoutSnapshot
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
        document={document}
        entity={entity}
        layoutSnapshot={layoutSnapshot}
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
  document,
  layoutSnapshot,
  nodeEditPort,
  paintEditPort,
  readOnly,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly componentKey: string
  readonly dispatch: (command: EditorCommand) => unknown
  readonly document?: ComposeDocument
  readonly layoutSnapshot?: ComposeLayoutSnapshot
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
        document={document}
        entity={entity}
        layoutSnapshot={layoutSnapshot}
        readOnly={readOnly}
        nodeEditPort={nodeEditPort}
        paintEditPort={paintEditPort}
        value={value}
      />
    </DefinitionErrorBoundary>
  )
}

/** 解析并隔离一个尚未附加 ECS Component 的 Inspector 标题栏操作。 @public */
export function ComposeRegistryMissingComponentInspectorHeaderActions({
  registry,
  entity,
  componentKey,
  dispatch,
  document,
  layoutSnapshot,
  nodeEditPort,
  paintEditPort,
  readOnly,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly componentKey: string
  readonly dispatch: (command: EditorCommand) => unknown
  readonly document?: ComposeDocument
  readonly layoutSnapshot?: ComposeLayoutSnapshot
  readonly readOnly: boolean
  readonly nodeEditPort?: ComposeNodeEditPort
  readonly paintEditPort?: ComposePaintEditPort
}) {
  const definition = registry.getComponent(componentKey)
  const missingInspector = definition?.missingInspector
  if (
    entity.components[componentKey] !== undefined
    || !missingInspector
    || !missingInspector.isVisible(entity)
  ) return null
  const Actions = missingInspector.actions
  return (
    <DefinitionErrorBoundary
      area="component-inspector-header-actions"
      identity={componentKey}
      resetSignal={entity.components}
    >
      <Actions
        componentKey={componentKey}
        dispatch={dispatch}
        document={document}
        entity={entity}
        layoutSnapshot={layoutSnapshot}
        readOnly={readOnly}
        nodeEditPort={nodeEditPort}
        paintEditPort={paintEditPort}
      />
    </DefinitionErrorBoundary>
  )
}

/** 解析并隔离一个尚未附加 ECS Component 的 Inspector 引导正文。 @public */
export function ComposeRegistryMissingComponentInspector({
  registry,
  entity,
  componentKey,
  dispatch,
  document,
  layoutSnapshot,
  nodeEditPort,
  paintEditPort,
  readOnly,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly componentKey: string
  readonly dispatch: (command: EditorCommand) => unknown
  readonly document?: ComposeDocument
  readonly layoutSnapshot?: ComposeLayoutSnapshot
  readonly readOnly: boolean
  readonly nodeEditPort?: ComposeNodeEditPort
  readonly paintEditPort?: ComposePaintEditPort
}) {
  const definition = registry.getComponent(componentKey)
  const missingInspector = definition?.missingInspector
  if (
    entity.components[componentKey] !== undefined
    || !missingInspector
    || !missingInspector.content
    || !missingInspector.isVisible(entity)
  ) return null
  const Content = missingInspector.content
  return (
    <DefinitionErrorBoundary
      area="component-inspector"
      identity={componentKey}
      resetSignal={entity.components}
    >
      <Content
        componentKey={componentKey}
        dispatch={dispatch}
        document={document}
        entity={entity}
        layoutSnapshot={layoutSnapshot}
        readOnly={readOnly}
        nodeEditPort={nodeEditPort}
        paintEditPort={paintEditPort}
      />
    </DefinitionErrorBoundary>
  )
}

/** 解析并隔离 Entity Renderer 的可选 Props Inspector。 @public */
export function ComposeRegistryRendererInspector({
  registry,
  entity,
  dispatch,
  document,
  layoutSnapshot,
  nodeEditPort,
  paintEditPort,
  readOnly,
  scriptScope,
  propsBinding,
  propCategory,
}: {
  readonly registry: ComposeEntityRegistry
  readonly entity: ComposeEntity
  readonly dispatch: (command: EditorCommand) => unknown
  readonly document?: ComposeDocument
  readonly layoutSnapshot?: ComposeLayoutSnapshot
  readonly readOnly: boolean
  readonly scriptScope?: ComposePageScriptScope
  readonly propsBinding?: ComposeRendererInspectorBindingPort
  readonly propCategory?: ComposeRendererPropCategory
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
  const resolved = resolveComposeRendererRuntimeProps({
    entity,
    definition,
    scope: scriptScope,
    methodMode: 'noop',
  })
  return (
    <DefinitionErrorBoundary
      area="renderer-inspector"
      identity={renderer.type}
      resetSignal={renderer}
    >
      <Inspector
        dispatch={dispatch}
        document={document}
        entity={entity}
        layoutSnapshot={layoutSnapshot}
        readOnly={readOnly}
        nodeEditPort={nodeEditPort}
        paintEditPort={paintEditPort}
        propCategory={propCategory}
        authoredProps={resolved.authoredProps}
        props={resolved.props}
        propsBinding={propsBinding}
        renderer={renderer}
      />
    </DefinitionErrorBoundary>
  )
}
