import { useMemo } from 'react'
import {
  collectComposeSwitcherHiddenIds,
  resolveComposeSwitcherPreview,
  type ComposeDocument,
} from '@compose-ui/core'

/** 用 NUL 拼接 ID 列表；Entity ID 不含该字符，因此拼接可逆且不会产生歧义。 */
const ID_SEPARATOR = '\u0000'

function joinIds(ids: Iterable<string>) {
  return [...ids].join(ID_SEPARATOR)
}

function splitIds(key: string) {
  return key === '' ? [] : key.split(ID_SEPARATOR)
}

/**
 * 求当前该隐藏的 Entity 集合——Switcher 未选中的分支。
 *
 * @remarks
 * **返回值的引用稳定性是硬要求，不是优化。** 场景子树与 SceneIndex 缓存都以这个 Set 作键：
 * 每次文档编辑都换一个新引用会重建整棵场景，而重建会让正在 DOM 上测量的实例内部选中框丢失。
 * 因此这里刻意套了两层记忆化，两层各解决一个问题，缺一不可：
 *
 * - **外层**把结果的身份绑到内容而非计算过程——内容没变就返回同一个 Set。
 * - **内层**把依赖从选区数组换成它的内容 key。宿主每次渲染都可能传入新的 `selectedIds`
 *   数组，直接拿数组作依赖会让每个平移帧都重新遍历一次文档。
 *
 * 看起来可以合并成一层，实际不能：合并之后要么丢掉引用稳定，要么丢掉内容依赖。
 */
export function useStageHiddenEntityIds(
  document: ComposeDocument,
  selectedIds: readonly string[],
): ReadonlySet<string> {
  const selectionKey = joinIds(selectedIds)
  const hiddenIdsKey = useMemo(
    () => joinIds(collectComposeSwitcherHiddenIds(
      document,
      resolveComposeSwitcherPreview(document, splitIds(selectionKey)),
    )),
    [document, selectionKey],
  )
  return useMemo(() => new Set(splitIds(hiddenIdsKey)), [hiddenIdsKey])
}
