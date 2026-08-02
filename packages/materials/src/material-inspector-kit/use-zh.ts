import { useComposeI18nContext } from '@compose-ui/ui-context'

/**
 * 判断当前 Inspector 是否使用中文文案。
 *
 * @remarks
 * 基础物料的内建 Inspector 只有中英两套文案，不接入完整消息目录；集中在这里避免每个
 * Inspector 各写一份 locale 判断。
 *
 * @returns locale 为 `zh-CN`（含未提供 Context 的默认值）时为 `true`。
 * @internal
 */
export function useZh(): boolean {
  return (useComposeI18nContext()?.locale ?? 'zh-CN') === 'zh-CN'
}
