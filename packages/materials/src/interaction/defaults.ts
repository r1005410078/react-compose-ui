import type { ComposeInteraction } from '@compose-ui/core'

/**
 * 新增 `Interaction` 时的初值。
 *
 * @remarks
 * 默认给一条目标为空的 click→navigate：用户点「添加交互」的意图几乎总是"配一个跳转"，
 * 给空数组会让他们还得再点一次「添加项」。目标留空由 node editor 接管，与 Page Slot 一致。
 * @internal
 */
export const DEFAULT_COMPOSE_INTERACTION: ComposeInteraction = Object.freeze({
  version: 1,
  triggers: [{ event: 'click', action: { type: 'navigate', target: null } }],
} satisfies ComposeInteraction)
