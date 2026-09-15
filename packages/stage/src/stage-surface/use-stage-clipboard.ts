import { useCallback, useState } from 'react'
import type { ComposeDocument, ComposeLayoutSnapshot } from '@compose-ui/core'
import {
  createEntityClipboard,
  createPasteFromClipboard,
  getEntityParentId,
  isInvalidCutInsertion,
  resolveSuggestedEntityInsertion,
  type StagePoint,
  type StageSceneIndex,
} from '@compose-ui/stage-engine'
import type {
  ComposeStageClipboard,
  ComposeStageDelegatableAction,
  ComposeStageDispatch,
  ComposeStagePasteTarget,
  ComposeStageShortcutActionDetail,
} from '../types'

/** 剪贴板动作；与快捷键动作同名，因此可以直接转交宿主委派。 */
export type StageClipboardAction = 'edit.copy' | 'edit.cut' | 'edit.paste'

/** 剪贴板能力的依赖清单。 */
export interface StageClipboardParams {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  /** 场景索引；粘贴落点用它找指针下的容器，与拖放落点同一条判据。 */
  readonly index: StageSceneIndex
  /** 已归一化的选区；无显式目标时的默认来源与粘贴锚点都取自它。 */
  readonly normalizedSelection: readonly string[]
  /** 激活场景 ID；无命中目标时粘贴落进它。 */
  readonly activeFrameId: string | null | undefined
  /** 受控剪贴板；`undefined` 表示由本 Hook 自己持有。 */
  readonly clipboard: ComposeStageClipboard | null | undefined
  readonly onClipboardChange?: (clipboard: ComposeStageClipboard | null) => void
  readonly dispatch: ComposeStageDispatch
  readonly idFactory: () => string
  readonly onSelectedIdsChange: (ids: readonly string[]) => void
  readonly onShortcutAction?: (
    action: ComposeStageDelegatableAction,
    detail?: ComposeStageShortcutActionDetail,
  ) => boolean
}

/** 剪贴板能力的出口。 */
export interface StageClipboard {
  /** 当前剪贴板内容；受控时即宿主传入的值。 */
  readonly clipboard: ComposeStageClipboard | null
  /**
   * 执行一次剪贴板动作。
   *
   * @param targetId - 右键命中的对象；`undefined` 表示来自快捷键，没有显式目标。
   *   注意 `null` 与 `undefined` 不同：`null` 是「明确右键在空白处」。
   * @param worldPoint - 粘贴时指针的世界坐标；给了就把整组副本落到那里、父级取指针下的
   *   容器。指针不在图面上时传 `null`/省略，粘贴退回建议落点。复制与剪切不读它。
   */
  readonly executeClipboard: (
    action: StageClipboardAction,
    targetId?: string | null,
    worldPoint?: StagePoint | null,
  ) => void
  /** 针对某个右键目标的三项可用性。 */
  readonly availabilityFor: (targetId: string | null) => StageClipboardAvailability
}

/** 右键菜单要显示的剪贴板可用性。 */
export interface StageClipboardAvailability {
  readonly canCopy: boolean
  readonly canCut: boolean
  readonly canPaste: boolean
}

/**
 * 「用户对选中对象做剪贴板操作」这条能力。
 *
 * @remarks
 * 剪贴板是**可选受控**的：宿主传了 `clipboard` 就完全由宿主拥有，否则本 Hook 自持一份本地
 * 状态。两种模式下写入都要先通知 `onClipboardChange`，因此宿主可以只监听而不接管。
 */
export function useStageClipboard(params: StageClipboardParams): StageClipboard {
  const {
    activeFrameId,
    clipboard: controlledClipboard,
    dispatch,
    document,
    idFactory,
    index,
    layoutSnapshot,
    normalizedSelection,
    onClipboardChange,
    onSelectedIdsChange,
    onShortcutAction,
  } = params
  const [localClipboard, setLocalClipboard] = useState<ComposeStageClipboard | null>(null)
  const clipboard = controlledClipboard !== undefined ? controlledClipboard : localClipboard

  const writeClipboard = (next: ComposeStageClipboard | null) => {
    if (onClipboardChange) onClipboardChange(next)
    else if (controlledClipboard === undefined) setLocalClipboard(next)
  }

  /** 右键命中了选区之外的对象时只操作它，否则操作整个选区。 */
  const sourceIds = useCallback((explicitId?: string | null) => (
    explicitId && !normalizedSelection.includes(explicitId)
      ? [explicitId]
      : normalizedSelection
  ), [normalizedSelection])

  /**
   * 指针指着的粘贴落点。
   *
   * @remarks
   * 父级取指针下的容器（与拖放落点同一条判据），剪切时排除来源自己——把一个容器剪下来
   * 再粘到它自己里面不是落点；指针不在任何容器里时落进激活场景。
   */
  const resolvePasteTarget = (worldPoint: StagePoint): ComposeStagePasteTarget | null => {
    const containerId = index.containerAtPoint(
      worldPoint,
      clipboard?.kind === 'cut' ? clipboard.entityIds : [],
    )
    const insertion = resolveSuggestedEntityInsertion(document, containerId, activeFrameId)
    return insertion ? { worldPoint, insertion } : null
  }

  const executeClipboard = (
    action: StageClipboardAction,
    targetId?: string | null,
    worldPoint?: StagePoint | null,
  ) => {
    const pasteTarget = action === 'edit.paste' && worldPoint ? resolvePasteTarget(worldPoint) : null
    if (onShortcutAction?.(action, action === 'edit.paste' ? { pasteTarget } : undefined)) return
    if (action === 'edit.copy' || action === 'edit.cut') {
      const next = createEntityClipboard(
        document,
        sourceIds(targetId),
        action === 'edit.copy' ? 'copy' : 'cut',
      )
      if (next) writeClipboard(next)
      return
    }
    const insertionTarget = targetId === undefined
      ? (normalizedSelection[normalizedSelection.length - 1] ?? null)
      : targetId
    // 无命中目标时落进激活场景，而不是 rootIds 里恰好排第一的那块。
    const insertion = pasteTarget?.insertion
      ?? resolveSuggestedEntityInsertion(document, insertionTarget, activeFrameId)
    if (!clipboard || !insertion) return
    const plan = createPasteFromClipboard(
      document,
      clipboard,
      insertion,
      idFactory,
      layoutSnapshot,
      pasteTarget ? { worldPoint: pasteTarget.worldPoint } : null,
    )
    if (!plan) return
    if (dispatch(plan.command).status === 'committed') {
      onSelectedIdsChange(plan.nextSelection)
      if (plan.clearClipboard) writeClipboard(null)
    }
  }

  /*
   * 可用性只随文档、选区与剪贴板变，而它被 Stage 每次渲染都问一遍——平移的每一帧都是一次
   * 渲染。判「能不能复制」要真的把剪贴板载荷装一遍（走整份文档），两项就是两遍；一份五千
   * 实体的图纸上每帧近 1ms，还留下一堆等着回收的垃圾。因此引用稳定，调用方按输入记忆化。
   */
  const availabilityFor = useCallback((targetId: string | null): StageClipboardAvailability => {
    const ids = sourceIds(targetId)
    const insertion = resolveSuggestedEntityInsertion(document, targetId, activeFrameId)
    return {
      canCopy: createEntityClipboard(document, ids, 'copy') !== null,
      canCut: createEntityClipboard(document, ids, 'cut') !== null,
      canPaste: Boolean(clipboard && insertion && (
        clipboard.kind === 'copy'
          ? clipboard.entityIds.every((id) => document.entities[id])
          // 剪切后原位置已经不在了，粘回同一个父级是 no-op；跨父级则需要布局快照重算几何。
          : !isInvalidCutInsertion(document, clipboard.entityIds, insertion)
            && (
              clipboard.entityIds.every((id) =>
                getEntityParentId(document, id) === insertion.parentId)
              || layoutSnapshot
            )
      )),
    }
  }, [activeFrameId, clipboard, document, layoutSnapshot, sourceIds])

  return { clipboard, executeClipboard, availabilityFor }
}
