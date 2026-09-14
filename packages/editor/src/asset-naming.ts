/**
 * 同目录下的资源命名去重。
 *
 * @remarks
 * 两个消费者：图片上传，以及 DXF 导入——后者一次落一份页面文件与若干组件文件，而**块名天生
 * 会撞**：`CCSYM00200102` 这类名字来自标准符号库，同一家设计院出的两张图必然带着同名的块。
 * 不去重的症状是第二次导入直接抛 `Asset "…" already exists`，而用户没做错任何事。
 *
 * @internal
 */

/** 为同目录重复写入生成最小可用数字后缀。 @internal */
export function uniqueProviderAssetName(
  requestedName: string,
  existingNames: readonly string[],
) {
  const normalized = requestedName.trim() || 'image'
  const occupied = new Set(existingNames)
  if (!occupied.has(normalized)) return normalized
  const extensionIndex = normalized.lastIndexOf('.')
  const hasExtension = extensionIndex > 0
  const base = hasExtension ? normalized.slice(0, extensionIndex) : normalized
  const extension = hasExtension ? normalized.slice(extensionIndex) : ''
  let suffix = 2
  while (occupied.has(`${base}-${suffix}${extension}`)) suffix += 1
  return `${base}-${suffix}${extension}`
}

/**
 * 为带**复合后缀**的资源文件名去重。
 *
 * @remarks
 * `uniqueProviderAssetName` 按最后一个点切，对 `.png` 没问题，对 `.component.json` 就会切出
 * `A3.component-2.json`——而 `.component.json` 正是组件文件的识别依据
 * （`isComposeComponentFileName`），后缀一破这个文件就不再是组件了。因此这里对**基名**加
 * 后缀，再交给 `toFileName` 拼出完整名字。
 *
 * `taken` 就地记入返回的名字：一次导入连续写多份文件，而目录列表在下一次写入之前就已经过期。
 *
 * @internal
 */
export function uniqueComposeAssetFileName(
  toFileName: (baseName: string) => string,
  baseName: string,
  taken: Set<string>,
) {
  let candidate = toFileName(baseName)
  let suffix = 2
  while (taken.has(candidate)) {
    candidate = toFileName(`${baseName}-${suffix}`)
    suffix += 1
  }
  taken.add(candidate)
  return candidate
}
