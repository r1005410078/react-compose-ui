import { useState } from 'react'
import type { ComposeDocument, ComposeLayoutSnapshot } from '@compose-ui/core'
import {
  createEntityClipboard,
  createPasteFromClipboard,
  getEntityParentId,
  isInvalidCutInsertion,
  resolveSuggestedEntityInsertion,
} from '@compose-ui/stage-engine'
import type {
  ComposeStageClipboard,
  ComposeStageDelegatableAction,
  ComposeStageDispatch,
} from '../types'

/** 剪贴板动作；与快捷键动作同名，因此可以直接转交宿主委派。 */
export type StageClipboardAction = 'edit.copy' | 'edit.cut' | 'edit.paste'

/** 剪贴板能力的依赖清单。 */
export interface StageClipboardParams {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
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
  readonly onShortcutAction?: (action: ComposeStageDelegatableAction) => boolean
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
   */
  readonly executeClipboard: (action: StageClipboardAction, targetId?: string | null) => void
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
  const sourceIds = (explicitId?: string | null) => (
    explicitId && !normalizedSelection.includes(explicitId)
      ? [explicitId]
      : normalizedSelection
  )

  const executeClipboard = (action: StageClipboardAction, targetId?: string | null) => {
    if (onShortcutAction?.(action)) return
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
    const insertion = resolveSuggestedEntityInsertion(document, insertionTarget, activeFrameId)
    if (!clipboard || !insertion) return
    const plan = createPasteFromClipboard(
      document,
      clipboard,
      insertion,
      idFactory,
      layoutSnapshot,
    )
    if (!plan) return
    if (dispatch(plan.command).status === 'committed') {
      onSelectedIdsChange(plan.nextSelection)
      if (plan.clearClipboard) writeClipboard(null)
    }
  }

  const availabilityFor = (targetId: string | null): StageClipboardAvailability => {
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
  }

  return { clipboard, executeClipboard, availabilityFor }
}
