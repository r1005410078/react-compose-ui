import { ComposeEditor } from '@compose-ui/editor'
import type { SceneTreeNode, SceneTreeOperation } from '@compose-ui/scene-tree'
import { useMemo, useRef, useState } from 'react'
import './App.css'

interface TextComponent {
  id: string
  text: string
}

type MoveOperation = Extract<SceneTreeOperation, { type: 'move' }>

const dragFixtureNodes: readonly SceneTreeNode[] = [{
  id: 'page',
  label: 'Page 1',
  canMove: false,
  children: [
    {
      id: 'group-a',
      label: 'Group A',
      children: [
        { id: 'layer-1', label: 'Layer 1', canHaveChildren: false },
        { id: 'layer-2', label: 'Layer 2', canHaveChildren: false },
        { id: 'layer-3', label: 'Layer 3', canHaveChildren: false },
      ],
    },
    { id: 'group-b', label: 'Group B', children: [] },
    { id: 'loose', label: 'Loose', canHaveChildren: false },
  ],
}]

const defaultSceneNodes: readonly SceneTreeNode[] = [{
  id: 'page',
  label: 'Page 1',
  canMove: false,
  children: [],
}]

function applySceneMove(
  nodes: readonly SceneTreeNode[],
  operation: MoveOperation,
): readonly SceneTreeNode[] {
  const movingSet = new Set(operation.nodeIds)
  const removed = new Map<string, SceneTreeNode>()
  const locations = new Map<string, { parentId: string | null; index: number }>()

  const removeMovingNodes = (
    source: readonly SceneTreeNode[],
    parentId: string | null,
  ): readonly SceneTreeNode[] => source.flatMap((node, index) => {
    if (movingSet.has(node.id)) {
      removed.set(node.id, node)
      locations.set(node.id, { parentId, index })
      return []
    }
    if (!node.children) return [node]
    return [{ ...node, children: removeMovingNodes(node.children, node.id) }]
  })

  const remaining = removeMovingNodes(nodes, null)
  const movingNodes = operation.nodeIds
    .map((nodeId) => removed.get(nodeId))
    .filter((node): node is SceneTreeNode => Boolean(node))
  if (movingNodes.length !== operation.nodeIds.length) return nodes

  const removedBeforeTarget = operation.nodeIds.filter((nodeId) => {
    const location = locations.get(nodeId)
    return location?.parentId === operation.parentId && location.index < operation.index
  }).length
  const adjustedIndex = Math.max(0, operation.index - removedBeforeTarget)
  if (operation.parentId === null) {
    const result = [...remaining]
    result.splice(Math.min(adjustedIndex, result.length), 0, ...movingNodes)
    return result
  }

  let inserted = false
  const insertIntoParent = (source: readonly SceneTreeNode[]): readonly SceneTreeNode[] => (
    source.map((node) => {
      if (node.id === operation.parentId) {
        inserted = true
        const children = [...(node.children ?? [])]
        children.splice(Math.min(adjustedIndex, children.length), 0, ...movingNodes)
        return { ...node, children }
      }
      if (!node.children) return node
      return { ...node, children: insertIntoParent(node.children) }
    })
  )
  const result = insertIntoParent(remaining)
  return inserted ? result : nodes
}

function updateSceneNodeLabel(
  nodes: readonly SceneTreeNode[],
  nodeId: string,
  label: string,
): readonly SceneTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    label: node.id === nodeId ? label : node.label,
    children: node.children
      ? updateSceneNodeLabel(node.children, nodeId, label)
      : undefined,
  }))
}

function removeSceneNodes(
  nodes: readonly SceneTreeNode[],
  removedIds: ReadonlySet<string>,
): readonly SceneTreeNode[] {
  return nodes.flatMap((node) => (
    removedIds.has(node.id)
      ? []
      : [{
          ...node,
          children: node.children ? removeSceneNodes(node.children, removedIds) : undefined,
        }]
  ))
}

function insertSceneNode(
  nodes: readonly SceneTreeNode[],
  parentId: string,
  index: number | undefined,
  insertedNode: SceneTreeNode,
): readonly SceneTreeNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      const children = [...(node.children ?? [])]
      children.splice(Math.min(index ?? children.length, children.length), 0, insertedNode)
      return { ...node, children }
    }
    if (!node.children) return node
    return { ...node, children: insertSceneNode(node.children, parentId, index, insertedNode) }
  })
}

function insertSceneNodes(
  nodes: readonly SceneTreeNode[],
  parentId: string | null,
  index: number,
  insertedNodes: readonly SceneTreeNode[],
): readonly SceneTreeNode[] {
  if (parentId === null) {
    const result = [...nodes]
    result.splice(Math.min(index, result.length), 0, ...insertedNodes)
    return result
  }
  return nodes.map((node) => {
    if (node.id === parentId) {
      const children = [...(node.children ?? [])]
      children.splice(Math.min(index, children.length), 0, ...insertedNodes)
      return { ...node, children }
    }
    return node.children
      ? { ...node, children: insertSceneNodes(node.children, parentId, index, insertedNodes) }
      : node
  })
}

function findSceneNode(
  nodes: readonly SceneTreeNode[],
  nodeId: string,
): SceneTreeNode | null {
  const stack = [...nodes].reverse()
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    if (node.id === nodeId) return node
    if (node.children) stack.push(...[...node.children].reverse())
  }
  return null
}

function collectSceneSubtreeIds(
  nodes: readonly SceneTreeNode[],
  rootIds: readonly string[],
): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const rootId of rootIds) {
    const root = findSceneNode(nodes, rootId)
    if (!root) continue
    const stack = [root]
    while (stack.length > 0) {
      const node = stack.pop()
      if (!node || ids.has(node.id)) continue
      ids.add(node.id)
      if (node.children) stack.push(...node.children)
    }
  }
  return ids
}

function collectSceneNodeIds(nodes: readonly SceneTreeNode[]): readonly string[] {
  const ids: string[] = []
  const stack = [...nodes].reverse()
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    ids.push(node.id)
    if (node.children) stack.push(...[...node.children].reverse())
  }
  return ids
}

function App() {
  const [textComponents, setTextComponents] = useState<readonly TextComponent[]>([])
  const [normalSceneNodes, setNormalSceneNodes] = useState(defaultSceneNodes)
  const [selectedSceneIds, setSelectedSceneIds] = useState<readonly string[]>(['page'])
  const [normalExpandedIds, setNormalExpandedIds] = useState<readonly string[]>(['page'])
  const [dragNodes, setDragNodes] = useState(dragFixtureNodes)
  const [dragSelectedIds, setDragSelectedIds] = useState<readonly string[]>([])
  const [dragExpandedIds, setDragExpandedIds] = useState<readonly string[]>(['page', 'group-a'])
  const [command, setCommand] = useState('')
  const nextTextIdRef = useRef(1)

  const selectedText = [...selectedSceneIds]
    .reverse()
    .map((nodeId) => textComponents.find(({ id }) => id === nodeId))
    .find((component): component is TextComponent => Boolean(component)) ?? null

  const searchParams = new URLSearchParams(window.location.search)
  const sceneSize = Number(searchParams.get('sceneSize'))
  const useDragFixture = searchParams.get('sceneDrag') === '1'
  const sceneNodes = useMemo<readonly SceneTreeNode[]>(() => {
    if (useDragFixture) return dragNodes
    if (sceneSize === 5000) {
      return [{
        id: 'page',
        label: 'Page 1',
        children: Array.from({ length: 4999 }, (_, index) => ({
          id: `node-${index + 1}`,
          label: `Node ${index + 1}`,
        })),
      }]
    }
    return normalSceneNodes
  }, [dragNodes, normalSceneNodes, sceneSize, useDragFixture])

  const orderedTextComponents = useMemo(() => {
    const positions = new Map(
      collectSceneNodeIds(normalSceneNodes).map((nodeId, index) => [nodeId, index]),
    )
    return [...textComponents].sort(
      (left, right) => (positions.get(left.id) ?? Infinity) - (positions.get(right.id) ?? Infinity),
    )
  }, [normalSceneNodes, textComponents])

  const addTextComponent = (parentId: string | null = 'page', index?: number) => {
    const number = nextTextIdRef.current
    nextTextIdRef.current += 1
    const id = `text-${number}`
    const text = number === 1 ? '默认文本' : `默认文本 ${number}`
    setTextComponents((current) => [
      ...current,
      { id, text },
    ])
    setNormalSceneNodes((current) => parentId === null
      ? insertSceneNodes(current, null, index ?? current.length, [{ id, label: text }])
      : insertSceneNode(current, parentId, index, { id, label: text }))
    if (parentId !== null) {
      setNormalExpandedIds((current) => current.includes(parentId)
        ? current
        : [...current, parentId])
    }
  }

  const updateTextComponent = (nodeId: string, text: string) => {
    setTextComponents((current) => current.map((component) => (
      component.id === nodeId ? { ...component, text } : component
    )))
    setNormalSceneNodes((current) => updateSceneNodeLabel(current, nodeId, text))
  }

  const handleSceneOperation = (operation: SceneTreeOperation) => {
    if (useDragFixture && operation.type === 'move') {
      setDragNodes((current) => applySceneMove(current, operation))
      return
    }
    if (!useDragFixture && operation.type === 'move') {
      setNormalSceneNodes((current) => applySceneMove(current, operation))
      const parentId = operation.parentId
      if (parentId) {
        setNormalExpandedIds((current) => current.includes(parentId)
          ? current
          : [...current, parentId])
      }
      return
    }
    if (!useDragFixture && operation.type === 'duplicate') {
      const duplicatedComponents: TextComponent[] = []
      const duplicatedIds: string[] = []
      const cloneNode = (source: SceneTreeNode): SceneTreeNode => {
        const number = nextTextIdRef.current
        nextTextIdRef.current += 1
        const id = `text-${number}`
        duplicatedIds.push(id)
        const sourceComponent = textComponents.find((component) => component.id === source.id)
        if (sourceComponent) duplicatedComponents.push({ id, text: sourceComponent.text })
        return {
          ...source,
          id,
          children: source.children?.map(cloneNode),
        }
      }
      const copies = operation.sourceNodeIds
        .map((nodeId) => findSceneNode(normalSceneNodes, nodeId))
        .filter((node): node is SceneTreeNode => Boolean(node))
        .map(cloneNode)
      if (copies.length !== operation.sourceNodeIds.length) return
      setNormalSceneNodes((current) => insertSceneNodes(
        current,
        operation.parentId,
        operation.index,
        copies,
      ))
      setTextComponents((current) => [...current, ...duplicatedComponents])
      setSelectedSceneIds(duplicatedIds)
      if (operation.parentId) {
        setNormalExpandedIds((current) => current.includes(operation.parentId!)
          ? current
          : [...current, operation.parentId!])
      }
      return
    }
    if (operation.type === 'create') {
      addTextComponent(operation.parentId, operation.index)
    }
    if (operation.type === 'rename') {
      updateTextComponent(operation.nodeId, operation.label)
    }
    if (operation.type === 'delete') {
      const deletedIds = collectSceneSubtreeIds(normalSceneNodes, operation.nodeIds)
      setTextComponents((current) => current.filter(({ id }) => !deletedIds.has(id)))
      setNormalSceneNodes((current) => removeSceneNodes(current, deletedIds))
      setSelectedSceneIds((current) => current.filter((nodeId) => !deletedIds.has(nodeId)))
      setNormalExpandedIds((current) => current.filter((nodeId) => !deletedIds.has(nodeId)))
    }
  }

  return (
    <ComposeEditor
      className="editor-workspace"
      sceneTreeProps={{
        nodes: sceneNodes,
        selectedIds: useDragFixture ? dragSelectedIds : selectedSceneIds,
        expandedIds: useDragFixture ? dragExpandedIds : normalExpandedIds,
        onSelectionChange: (nodeIds) => {
          if (useDragFixture) {
            setDragSelectedIds(nodeIds)
            return
          }
          setSelectedSceneIds(nodeIds)
        },
        onExpandedChange: (nodeIds) => {
          if (useDragFixture) {
            setDragExpandedIds(nodeIds)
            return
          }
          setNormalExpandedIds(nodeIds)
        },
        onOperation: handleSceneOperation,
      }}
          canvasToolbar={
            <div className="canvas-tools">
              <button className="tool-button is-active" type="button">
                选择
              </button>
              <button className="tool-button" type="button">
                平移
              </button>
              <span className="tool-divider" />
              <button
                className="add-button"
                type="button"
                onClick={() => addTextComponent()}
              >
                添加文本组件
              </button>
              <span className="zoom-value">100%</span>
            </div>
          }
          inspectorPanel={
            <div className="inspector-panel">
              {selectedText ? (
                <>
                  <div className="inspector-heading">
                    <span className="node-icon">T</span>
                    <div>
                      <strong>{selectedText.text}</strong>
                      <span>文本组件</span>
                    </div>
                  </div>
                  <div className="property-section">
                    <strong>Content</strong>
                    <label className="property-field">
                      <span>文本内容</span>
                      <input
                        value={selectedText.text}
                        onChange={(event) => updateTextComponent(selectedText.id, event.target.value)}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <p className="empty-message">选择画布中的组件以编辑属性</p>
              )}
            </div>
          }
          transactionLogPanel={
            <ol className="transaction-list">
              <li>
                <span>workspace.ready</span>
                <time>当前会话</time>
              </li>
              {textComponents.map((component) => (
                <li key={component.id}>
                  <span>component.text.update</span>
                  <time>{component.text}</time>
                </li>
              ))}
            </ol>
          }
          commandPanel={
            <form className="command-form" onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="workspace-command">输入编辑器命令</label>
              <div>
                <span aria-hidden="true">›</span>
                <input
                  id="workspace-command"
                  value={command}
                  placeholder="例如：add text"
                  onChange={(event) => setCommand(event.target.value)}
                />
              </div>
            </form>
          }
        >
          <section aria-label="编辑画布" className="editor-canvas">
            <div className="canvas-grid" aria-hidden="true" />
            {orderedTextComponents.length === 0 ? (
              <span className="canvas-empty">点击工具栏按钮添加组件</span>
            ) : (
              <div className="canvas-components">
                {orderedTextComponents.map((component) => (
                  <button
                    className="text-node"
                    key={component.id}
                    type="button"
                    onClick={() => setSelectedSceneIds([component.id])}
                  >
                    {component.text}
                  </button>
                ))}
              </div>
            )}
        </section>
    </ComposeEditor>
  )
}

export default App
