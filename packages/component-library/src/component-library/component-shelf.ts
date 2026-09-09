import type { ComposeComponentCatalog, ComposeComponentDescriptor } from '../component-store'

/**
 * 一段来自 Registry 基础 Preset 的货架。
 *
 * @remarks
 * 这是货架里**唯一**按单项挑的来源：基础 Preset 只有几个、每个都有代码里的稳定 id，逐个勾
 * 才有意义。资源里的组件按文件夹取，见 {@link ComposeComponentShelfFolderSection}。
 *
 * @public
 */
export interface ComposeComponentShelfPresetSection {
  readonly kind: 'presets'
  /** 段的稳定 id；折叠状态与「去掉」按它寻址。 */
  readonly id: string
  /** 段标题；缺省时按来源取（基础组件 / 文件夹名）。 */
  readonly title?: string
  /**
   * 要列出的 Preset id；缺省即全部可见 Preset。
   *
   * @remarks
   * 被藏起来的 Preset 即使写进来也不会出现——它们藏不藏由 `paletteHidden` 的判据决定，不是
   * 这份货架的决定。调用方负责把那个判据求值完再把 Preset 交进来。
   */
  readonly include?: readonly string[]
  /** 初始折叠。 @defaultValue false */
  readonly collapsed?: boolean
}

/**
 * 一段来自资源文件夹的货架。
 *
 * @remarks
 * **选文件夹不选文件**：往这个文件夹里再导十个符号，它们自动出现，用户不必回来改设置；
 * 想建新分类就去资源里建文件夹。
 *
 * @public
 */
export interface ComposeComponentShelfFolderSection {
  readonly kind: 'folder'
  readonly id: string
  readonly title?: string
  /** 从 Provider 根往下的文件夹路径；空数组是根，即「全部项目组件」。 */
  readonly folderPath: readonly string[]
  /** 按一级子文件夹分组，还是全部平铺。 @defaultValue 'flat' */
  readonly groupBy?: 'flat' | 'subfolder'
  readonly collapsed?: boolean
}

/** 货架里的一段：一个来源。 @public */
export type ComposeComponentShelfSection =
  | ComposeComponentShelfPresetSection
  | ComposeComponentShelfFolderSection

/**
 * 物料面板的货架：面板列什么、按什么分段。
 *
 * @remarks
 * 它是**工作区**的字段而不是面板的模式：同一个面板组件，两份货架。标题与搜索也住在这里——
 * 带搜索的那份货架有几十项，不带的那份只有几项，搜索框在后者身上只是占地方。
 *
 * @public
 */
export interface ComposeComponentShelf {
  /** 面板标题；同时是它在 Dockview 上的标签名。 */
  readonly title?: string
  /** 是否显示跨段搜索框。 @defaultValue false */
  readonly search?: boolean
  readonly sections: readonly ComposeComponentShelfSection[]
}

/**
 * 缺省货架：基础组件一段 + 全部项目组件平铺一段。
 *
 * @remarks
 * 就是这个面板一直以来的样子有了个名字，因此不给 `shelf` 的宿主一个像素都不变。
 *
 * @public
 */
export const COMPOSE_DEFAULT_COMPONENT_SHELF: ComposeComponentShelf = {
  sections: [
    { kind: 'presets', id: 'basics' },
    { kind: 'folder', id: 'components', folderPath: [] },
  ],
}

/**
 * 货架解析要用到的一个 Preset 的可呈现半边。
 *
 * @remarks
 * `paletteHidden` 在这里已经是**求值之后**的布尔：Registry 上那个字段带着「为什么藏」的理由，
 * 其中 `'toolbar'` 一档要看当前工作区的工具栏货架，而本包不认识工具栏——判定住在调用方，
 * 交进来的就是答案。
 *
 * @internal
 */
export interface ComposeComponentShelfPreset {
  readonly id: string
  readonly label: string
  readonly paletteHidden?: boolean
}

/** 一段里的一个瓦片。 @internal */
export type ComposeComponentShelfTile =
  | { readonly kind: 'preset'; readonly presetId: string; readonly label: string }
  | { readonly kind: 'component'; readonly descriptor: ComposeComponentDescriptor }

/** 段内的一组瓦片；`title` 为 null 表示直接排在段标题下，不另起小标题。 @internal */
export interface ComposeComponentShelfGroup {
  readonly id: string
  readonly title: string | null
  readonly tiles: readonly ComposeComponentShelfTile[]
}

/** 一段解析后的样子。 @internal */
export interface ComposeComponentShelfViewSection {
  readonly id: string
  readonly title: string
  /** 段里的瓦片总数（搜索之后）。 */
  readonly count: number
  readonly groups: readonly ComposeComponentShelfGroup[]
  /** 定义里的初始折叠。 */
  readonly collapsed: boolean
  /** 引用的文件夹不在资源里了。此时 `groups` 为空，面板渲染一行「找不到」。 */
  readonly missing: boolean
}

/** 段标题的默认取值；由调用方给出已本地化的文案。 @internal */
export interface ComposeComponentShelfLabels {
  /** 基础 Preset 段的默认标题。 */
  readonly basics: string
  /** 根文件夹段的默认标题（「项目组件」）。 */
  readonly components: string
}

function samePath(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((segment, index) => segment === b[index])
}

function startsWithPath(path: readonly string[], prefix: readonly string[]) {
  return prefix.length <= path.length && prefix.every((segment, index) => segment === path[index])
}

function matches(text: string, query: string) {
  return query === '' || text.toLowerCase().includes(query)
}

/**
 * 把一份货架、Registry 的 Preset 与组件目录解析成面板直接渲染的分段。
 *
 * @remarks
 * 纯函数：折叠、搜索输入与「去掉」的会话状态留在面板里，这里只按当前的搜索词算出该画什么。
 * 搜索**跨段生效**：每段各自过滤，段标题保留——否则用户搜完看不出剩下的东西来自哪里。
 *
 * @internal
 */
export function resolveComponentShelf(input: {
  readonly shelf: ComposeComponentShelf
  readonly presets: readonly ComposeComponentShelfPreset[]
  readonly catalog: ComposeComponentCatalog | null
  readonly query: string
  readonly labels: ComposeComponentShelfLabels
  /** 子文件夹名与显示名排序用的语言。 */
  readonly locale?: string
}): readonly ComposeComponentShelfViewSection[] {
  const { catalog, labels, locale, presets, query, shelf } = input
  const needle = query.trim().toLowerCase()
  const components = catalog?.components ?? []
  const folders = catalog?.folders ?? []

  return shelf.sections.map((section): ComposeComponentShelfViewSection => {
    if (section.kind === 'presets') {
      const visible = presets.filter((preset) => preset.paletteHidden !== true)
      const tiles = visible
        .filter((preset) => section.include === undefined || section.include.includes(preset.id))
        .filter((preset) => matches(preset.label, needle))
        .map((preset): ComposeComponentShelfTile => ({
          kind: 'preset',
          presetId: preset.id,
          label: preset.label,
        }))
      return {
        id: section.id,
        title: section.title ?? labels.basics,
        count: tiles.length,
        groups: tiles.length > 0 ? [{ id: `${section.id}:all`, title: null, tiles }] : [],
        collapsed: section.collapsed ?? false,
        missing: false,
      }
    }

    const { folderPath } = section
    const title = section.title
      ?? (folderPath.length === 0 ? labels.components : folderPath[folderPath.length - 1]!)
    // 根永远在；只有具名文件夹会「没了」。目录还没读回来时不下这个判断——那一瞬间什么都没有，
    // 说「找不到」会让每次刷新都闪一行错。
    const missing = folderPath.length > 0
      && catalog !== null
      && !folders.some((candidate) => samePath(candidate, folderPath))
    if (missing) {
      return { id: section.id, title, count: 0, groups: [], collapsed: section.collapsed ?? false, missing: true }
    }

    const inFolder = components
      .filter((descriptor) => startsWithPath(descriptor.folderPath, folderPath))
      .filter((descriptor) => matches(descriptor.displayName, needle))
    const tileOf = (descriptor: ComposeComponentDescriptor): ComposeComponentShelfTile => ({
      kind: 'component',
      descriptor,
    })

    if ((section.groupBy ?? 'flat') === 'flat') {
      const tiles = inFolder.map(tileOf)
      return {
        id: section.id,
        title,
        count: tiles.length,
        groups: tiles.length > 0 ? [{ id: `${section.id}:all`, title: null, tiles }] : [],
        collapsed: section.collapsed ?? false,
        missing: false,
      }
    }

    // 分组的清单来自**文件夹**而不是组件：空的子文件夹同样占一组（写着 0），否则用户会以为
    // 自己刚建的分类没建上。
    const subfolders = folders
      .filter((candidate) => candidate.length === folderPath.length + 1
        && startsWithPath(candidate, folderPath))
      .map((candidate) => candidate[candidate.length - 1]!)
      .sort((a, b) => a.localeCompare(b, locale))
    const direct = inFolder.filter((descriptor) => descriptor.folderPath.length === folderPath.length)
    const groups: ComposeComponentShelfGroup[] = []
    if (direct.length > 0) groups.push({ id: `${section.id}:.`, title: null, tiles: direct.map(tileOf) })
    for (const name of subfolders) {
      const tiles = inFolder
        .filter((descriptor) => descriptor.folderPath[folderPath.length] === name)
        .map(tileOf)
      // 搜索期间空组收起来：用户要的是命中项，一屏写着 0 的组会把它们挤下去。
      if (needle !== '' && tiles.length === 0) continue
      groups.push({ id: `${section.id}:${name}`, title: name, tiles })
    }
    return {
      id: section.id,
      title,
      count: inFolder.length,
      groups,
      collapsed: section.collapsed ?? false,
      missing: false,
    }
  })
}
