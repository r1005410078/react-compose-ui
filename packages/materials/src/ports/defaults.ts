import type { ComposePorts } from '@compose-ui/core'

/**
 * 新增 `Ports` 时的初值。
 *
 * @remarks
 * 默认给一个落在 Entity 局部原点的端口：空列表是非法的（读不出意图），而用户点「添加端口」
 * 的意图就是「这里有一个接线点」，再让他们点一次「添加项」是白费一步。
 * @internal
 */
export const DEFAULT_COMPOSE_PORTS: ComposePorts = Object.freeze({
  items: [{ id: 'port-1', position: { x: 0, y: 0 } }],
} satisfies ComposePorts)

/**
 * 按既有端口推出下一个默认 id。
 *
 * @remarks
 * id 稳定是导线绑定不断的前提，因此新端口不能复用已有的 id；顺序号取「已有的最大号 + 1」
 * 而不是列表长度——删掉中间一项之后按长度取号会撞上仍然存在的那个 id。
 * @internal
 */
export function nextComposePortId(items: readonly { readonly id: string }[]): string {
  const used = new Set(items.map(({ id }) => id))
  let index = items.length + 1
  while (used.has(`port-${index}`)) index += 1
  return `port-${index}`
}
