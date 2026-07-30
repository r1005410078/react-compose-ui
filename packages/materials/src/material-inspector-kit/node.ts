import * as v from 'valibot'

/**
 * 生成使用 `node` 基础 editor 的页面引用属性 Schema。
 *
 * @remarks
 * 值形状与 `core` 的 `ComposePageReference` 一致（扁平字符串映射），因此可以直接写入
 * Renderer props。Schema 放在物料包而不是 `core`：`core` 不依赖 Schema 库。
 *
 * 该属性可空 —— 「未指向任何页面」是合法状态。node editor 会接管空值状态并在未设置时
 * 仍然提供选择入口与拖放目标。
 *
 * @param options - `title` 用于属性面板左列显示的名称。
 * @public
 */
export function composeNodePropertySchema(options?: { readonly title?: string }) {
  const base = v.nullable(v.object({
    kind: v.literal('page'),
    providerId: v.pipe(v.string(), v.minLength(1)),
    assetKey: v.pipe(v.string(), v.minLength(1)),
    scope: v.picklist(['persistent', 'session']),
  }))
  return v.pipe(
    base,
    v.title(options?.title ?? '页面'),
    v.metadata({ propertyPanel: { editor: 'node' } }),
  )
}
