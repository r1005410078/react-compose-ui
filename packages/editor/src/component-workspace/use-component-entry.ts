import {
  getComposeHierarchy,
  type ComposeDocument,
} from '@compose-ui/core'
import {
  readComposeComponentInstance,
  type ComposeComponentDescriptor,
} from '@compose-ui/component-library'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComposeEditorController } from '../editor-controller'
import type { ComposeWorkspaceDocumentSession } from '../workspace-layout'

/**
 * 来路中的一段。
 *
 * @remarks
 * 它是**会话状态**：不写文档、不进撤销历史、不进偏好。它回答「我这一刻在哪儿」，
 * 与工作区布局那种「我想怎么看」不是一回事，关掉编辑器就该没有。
 */
interface ComponentEntrySegment {
  /** 该段对应的文档会话。 */
  readonly panelId: string
  /** 从这一层进入下一层时的选区；返回到这一层时还原它。 */
  readonly selection: readonly string[]
  /**
   * 这一层被压上来之前，该会话就已经开着。
   *
   * @remarks
   * 只对层（栈底之上的每一段）有意义，决定返回时它的去留：进入只是临时借用了它的呈现，
   * 不该顺手把用户自己打开的那份文件关掉。
   */
  readonly preexisting: boolean
}

/** {@link useComponentEntry} 的受控输入。 @internal */
export interface UseComponentEntryInput {
  readonly activeDocumentPanelId: string | null
  readonly controller: ComposeEditorController | undefined
  readonly documents: ReadonlyMap<string, ComposeWorkspaceDocumentSession>
  /** 固定画布的面板 ID；它不是 `documents` 里的会话，但同样是一段可以返回的「文档」。 */
  readonly fixedCanvasPanelId: string
  readonly components: readonly ComposeComponentDescriptor[] | undefined
  readonly store: {
    readonly providerId: string
    readonly readComponent: (assetKey: string) => Promise<{
      readonly entryId: string
      readonly revision: string
      readonly asset: { readonly name: string; readonly componentId: string; readonly kind: 'base' | 'variant' }
    }>
    readonly createReference: (assetKey: string) => ComposeComponentDescriptor['reference']
  } | undefined
  readonly createPanelId: (providerId: string, assetKey: string) => string
  readonly openComponentDocument: (descriptor: ComposeComponentDescriptor) => Promise<void>
  readonly hasDocument: (panelId: string) => boolean
  /** 该文档有没有未保存的修改；必须读最新的一份而不是渲染期快照。 */
  readonly isDocumentDirty: (panelId: string) => boolean
  /** 直接关闭一个文档会话，不走脏确认——只有确认干净的层才会走到这里。 */
  readonly closeDocument: (panelId: string) => void
  readonly setActiveDocumentPanelId: (panelId: string) => void
  readonly onError: (message: string) => void
}

/** {@link useComponentEntry} 的输出。 @internal */
export interface ComponentEntrySession {
  /** 进入某个组件实例引用的组件资源。 */
  readonly enter: (entityId: string) => Promise<void>
  /** 返回上一层。 */
  readonly exit: () => void
  /** 当前这棵树有没有来路可回；根行据此决定画不画返回控件。 */
  readonly canExit: boolean
  /**
   * 此刻压着的层。
   *
   * @remarks
   * 它们是会话，但**不是标签**：标签条要把这些 panelId 剔除掉，离开一层的唯一出口是返回。
   */
  readonly layerPanelIds: readonly string[]
  /**
   * 层存续期间标签条应当高亮的那一条——来路的栈底。
   *
   * @remarks
   * 用户仍站在那份文档上，只是进了它内部的一层（Unity 的 Scene 视图面包屑第一段就是场景）。
   * 没有层时为 `null`，标签条照旧高亮当前文档。
   */
  readonly originPanelId: string | null
}

/**
 * 求出让这些实体在场景树上可见所需展开的全部祖先。
 *
 * @remarks
 * 返回时要把来路那个实例重新选中，而它的祖先此刻可能是折叠的——选中一行看不见的行，
 * 与没有还原选区在屏幕上没有区别。
 */
function collectEntityAncestors(
  document: ComposeDocument,
  ids: readonly string[],
): readonly string[] {
  const parentOf = new Map<string, string>()
  for (const entity of Object.values(document.entities)) {
    for (const childId of getComposeHierarchy(entity)?.childIds ?? []) {
      parentOf.set(childId, entity.id)
    }
  }
  const ancestors = new Set<string>()
  for (const id of ids) {
    for (let current = parentOf.get(id); current !== undefined; current = parentOf.get(current)) {
      if (ancestors.has(current)) break
      ancestors.add(current)
    }
  }
  return [...ancestors]
}

/**
 * 场景树「进入组件 / 返回上一层」的会话。
 *
 * @remarks
 * 进的是实例**当前引用的直接父源**（引用变体就进变体，不追到根 Base），与 Apply 写回直接
 * 父源同一条判断。进入**不产生文档标签**：它是当前文档上的一次导航，那份组件会话被压成一层，
 * 返回时弹出。返回是**一步**的事，因此这里只记来路栈、不呈现路径。
 *
 * 一个 assetKey 至多一份会话、至多一种呈现——两份 runtime 指着同一份组件资源就是两个事实来源。
 *
 * 它住在自己的 Hook 而不是 Editor 组件体里：那个组件已经三千行，React Compiler 在它上面会
 * 放弃分析，连既有的 `react-hooks` 检查一起失效。
 *
 * @internal
 */
export function useComponentEntry(input: UseComponentEntryInput): ComponentEntrySession {
  const {
    activeDocumentPanelId,
    controller,
    documents,
    fixedCanvasPanelId,
    components,
    store,
    createPanelId,
    openComponentDocument,
    hasDocument,
    isDocumentDirty,
    closeDocument,
    setActiveDocumentPanelId,
    onError,
  } = input

  const [stack, setStack] = useState<readonly ComponentEntrySegment[]>([])
  /**
   * 正在打开、尚未压进栈的那一层。
   *
   * @remarks
   * 打开成功与写栈之间隔着一次 `await`，而打开本身就会让那份会话进 `documents`。少了这一位，
   * 标签条会在这两拍之间把它当成一条普通标签闪一下。用状态而不是 ref：这一位要参与渲染。
   */
  const [openingPanelId, setOpeningPanelId] = useState<string | null>(null)
  /**
   * 同一个目标的进入正在跑。
   *
   * @remarks
   * 与上面那一位是同一件事的两份，各有各的用处，不能合并：状态那一份要参与渲染，而这一份要在
   * **同一拍里**挡住第二次调用——连点两下进入按钮，两次 `enter` 来自同一次渲染的同一个闭包，
   * 那时状态还是旧值，只有 ref 读得到第一次刚写下的。
   */
  const openingRef = useRef<string | null>(null)
  /**
   * 返回后待还原的选区。
   *
   * @remarks
   * 切当前文档要经过宿主的 `onActiveSessionChange` 才换到目标 runtime，因此**不能**在切文档
   * 的同一拍里设选区——那时 controller 还指着上一份文档，选区会被它的校验丢掉。记在这里，
   * 等目标 runtime 真的成为 controller 的当前 runtime 时再应用。
   */
  const pendingRestoreRef = useRef<{
    readonly panelId: string
    readonly selection: readonly string[]
  } | null>(null)

  /**
   * 当前有效的来路。
   *
   * @remarks
   * 它必须描述**当前屏幕上这棵树**，否则根行会给出一个通往别处的返回控件：某一段的会话被关掉
   * 时截断到仍然存在的最长前缀；当前文档离开了栈顶时截断到它所在的那一段，不在栈里就整条丢弃。
   *
   * 这是**渲染期派生**而不是一个把栈改窄的 effect：栈只在用户进入或返回时写。
   */
  const visible = useMemo(() => {
    const alivePanel = (panelId: string) => hasDocument(panelId) || panelId === fixedCanvasPanelId
    let live = 0
    while (live < stack.length && alivePanel(stack[live]?.panelId ?? '')) live += 1
    const alive = stack.slice(0, live)
    if (alive.length === 0) return alive
    if (alive[alive.length - 1]?.panelId === activeDocumentPanelId) return alive
    const index = alive.findIndex((segment) => segment.panelId === activeDocumentPanelId)
    return index === -1 ? [] : alive.slice(0, index + 1)
  }, [activeDocumentPanelId, fixedCanvasPanelId, hasDocument, stack])

  /**
   * 放开一个被弹出的层。
   *
   * @remarks
   * 进入前就已存在，或有未保存的修改时保留——未保存的修改必须在屏幕上有一个家，而它一旦不再
   * 是层就会回到标签条。两者都不成立时关闭：干净的组件文档关掉零损失，再进去就是同一份。
   */
  const releaseLayer = useCallback((segment: ComponentEntrySegment) => {
    if (segment.preexisting || isDocumentDirty(segment.panelId)) return
    closeDocument(segment.panelId)
  }, [closeDocument, isDocumentDirty])

  const enter = useCallback(async (entityId: string) => {
    const document = controller?.document
    if (!store || !document) return
    const entity = document.entities[entityId]
    const facts = entity ? readComposeComponentInstance(entity) : null
    if (!facts) return
    const { assetKey } = facts.reference
    const targetPanelId = createPanelId(store.providerId, assetKey)

    /*
     * 目标已经在来路里：截断到那一段而不是再压一层——同一份会话在栈里出现两次，返回就会
     * 走进一个绕不出去的圈。Unity 的面包屑点回去就是这个。
     */
    const revisit = visible.findIndex((segment) => segment.panelId === targetPanelId)
    if (revisit !== -1) {
      const popped = visible.slice(revisit + 1)
      const target = visible[revisit]!
      pendingRestoreRef.current = { panelId: target.panelId, selection: target.selection }
      setStack(visible.slice(0, revisit + 1))
      setActiveDocumentPanelId(target.panelId)
      for (const segment of popped) releaseLayer(segment)
      return
    }

    /*
     * 同一个目标正在打开中就不再开第二次：连点两下进入按钮会发两次 enter，而第二次看到的
     * 目标已经被第一次打开了，`preexisting` 于是被记成 true——返回时那份会话被当成「用户
     * 自己打开的文件」留了下来，标签条上多出一条谁也没要过的标签。
     */
    if (openingRef.current === targetPanelId) return

    const fromPanelId = activeDocumentPanelId
    // 必须在打开**之前**问：打开之后它一定存在，这一位就再也读不出来了。
    const preexisting = hasDocument(targetPanelId)
    openingRef.current = targetPanelId
    setOpeningPanelId(targetPanelId)
    try {
      const fromCatalog = components?.find((item) => item.assetKey === assetKey)
      if (fromCatalog) await openComponentDocument(fromCatalog)
      else {
        try {
          const source = await store.readComponent(assetKey)
          await openComponentDocument({
            entryId: source.entryId,
            assetKey,
            displayName: source.asset.name || assetKey,
            componentId: source.asset.componentId,
            kind: source.asset.kind,
            revision: source.revision,
            reference: store.createReference(assetKey),
            // 只用来打开文档（按 assetKey 与引用寻址）；分组路径一律从目录读。
            folderPath: [],
          })
        }
        catch (error) {
          onError(error instanceof Error ? error.message : String(error))
          return
        }
      }
      // 路径栈在打开**成功之后**才写：失败时来路必须停在原地。
      if (!hasDocument(targetPanelId) || fromPanelId === null) return
      // 从栈顶继续进入就接着往下压；从别处进入则这条来路重新开始。
      const from = visible[visible.length - 1]
      const continuing = from?.panelId === fromPanelId
      setStack([
        ...(continuing ? visible.slice(0, -1) : []),
        {
          panelId: fromPanelId,
          selection: [entityId],
          preexisting: continuing ? from.preexisting : false,
        },
        { panelId: targetPanelId, selection: [], preexisting },
      ])
    }
    finally {
      openingRef.current = null
      setOpeningPanelId(null)
    }
  }, [
    activeDocumentPanelId,
    components,
    controller?.document,
    createPanelId,
    hasDocument,
    onError,
    openComponentDocument,
    releaseLayer,
    setActiveDocumentPanelId,
    store,
    visible,
  ])

  const exit = useCallback(() => {
    const top = visible[visible.length - 1]
    const previous = visible[visible.length - 2]
    if (!top || !previous) return
    pendingRestoreRef.current = { panelId: previous.panelId, selection: previous.selection }
    setStack(visible.slice(0, -1))
    // 先切走再放开：`closeDocument` 只在关掉的正是当前文档时才去挑邻居，而这里已经挑好了。
    setActiveDocumentPanelId(previous.panelId)
    releaseLayer(top)
  }, [releaseLayer, setActiveDocumentPanelId, visible])

  /*
   * 还原来路选区。判据是 controller 的 runtime 确实换成了目标文档那一份——只比对
   * `activeDocumentPanelId` 分不出「目标文档还没到位」与「那个实体已经被删了」，
   * 而前者要继续等、后者要放弃。
   */
  useEffect(() => {
    const pending = pendingRestoreRef.current
    if (!pending || !controller || pending.panelId !== activeDocumentPanelId) return
    const session = documents.get(pending.panelId)
    const runtime = session && 'runtime' in session ? session.runtime : undefined
    // 固定画布只有一份 runtime，没有可比对的会话；当前面板对上就是到位了。
    if (pending.panelId !== fixedCanvasPanelId && (!runtime || controller.runtime !== runtime)) {
      return
    }
    pendingRestoreRef.current = null
    const document = controller.document
    const ids = pending.selection.filter((id) => document.entities[id] !== undefined)
    if (ids.length === 0) return
    controller.setSelectedIds(ids)
    const ancestors = collectEntityAncestors(document, ids)
    if (ancestors.length > 0) {
      controller.setExpandedIds([...controller.expandedIds, ...ancestors])
    }
  }, [activeDocumentPanelId, controller, documents, fixedCanvasPanelId])

  const layerPanelIds = useMemo(() => {
    const layers = visible.slice(1).map((segment) => segment.panelId)
    return openingPanelId === null || layers.includes(openingPanelId)
      ? layers
      : [...layers, openingPanelId]
  }, [openingPanelId, visible])

  /*
   * 返回值要稳定：宿主拿它 memo 场景树的受控属性，每次渲染换一个新对象等于那个 memo 白写，
   * 整棵虚拟化的树会跟着编辑器的每一次渲染重渲。
   */
  return useMemo(() => ({
    enter,
    exit,
    canExit: visible.length >= 2,
    layerPanelIds,
    originPanelId: visible.length >= 2 ? visible[0]!.panelId : null,
  }), [enter, exit, layerPanelIds, visible])
}
