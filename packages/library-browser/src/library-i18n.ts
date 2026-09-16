/**
 * 页面库的文案。
 *
 * @remarks
 * 与 `asset-browser` 一样内建两种语言，宿主用 `ComposeI18nProvider` 选。文案不硬编码进组件
 * ——它们要被翻译，而组件不认识 locale。
 * @internal
 */
export interface ComposeLibraryMessages {
  readonly recent: string
  readonly project: string
  readonly template: string
  readonly trash: string
  readonly sceneType: string
  readonly uncategorized: string
  readonly search: string
  readonly sortModified: string
  readonly sortCreated: string
  readonly sortUsed: string
  readonly sortTitle: string
  readonly viewGrid: string
  readonly viewList: string
  readonly newPage: string
  readonly demo: string
  readonly use: string
  readonly open: string
  readonly seeAll: string
  readonly usedTimes: (count: number) => string
  readonly openNamed: (title: string) => string
  readonly useNamed: (title: string) => string
  readonly empty: string
  readonly emptyTrash: string
  readonly loading: string
  readonly loadFailed: string
  readonly retry: string
  readonly loadMore: string
  readonly demoPosition: (index: number, total: number) => string
  readonly demoPrev: string
  readonly demoNext: string
  readonly demoExit: string
  readonly instantiateTitle: string
  readonly instantiateName: string
  readonly instantiateHint: string
  readonly newPageTitle: string
  readonly newPageHint: string
  readonly newPageDefaultName: string
  readonly cancel: string
  readonly confirm: string
}

const zhCN: ComposeLibraryMessages = {
  recent: '最近打开',
  project: '项目',
  template: '模板',
  trash: '回收站',
  sceneType: '场景类型',
  uncategorized: '未分类',
  search: '搜索页面…',
  sortModified: '最近修改',
  sortCreated: '最近创建',
  sortUsed: '用得最多',
  sortTitle: '按名称',
  viewGrid: '网格视图',
  viewList: '列表视图',
  newPage: '新建页面',
  demo: '演示',
  use: '就用这个',
  open: '打开',
  seeAll: '看全部',
  usedTimes: (count) => `${count}×`,
  openNamed: (title) => `打开 ${title}`,
  useNamed: (title) => `以 ${title} 新建`,
  empty: '这里还没有页面',
  emptyTrash: '回收站是空的',
  loading: '正在载入…',
  loadFailed: '载入失败',
  retry: '重试',
  loadMore: '继续加载',
  demoPosition: (index, total) => `方案 ${index} / ${total}`,
  demoPrev: '上一张',
  demoNext: '下一张',
  demoExit: '退出演示',
  instantiateTitle: '以此新建页面',
  instantiateName: '名称',
  instantiateHint: '复制一份。此后两边再无关系。',
  newPageTitle: '新建页面',
  newPageHint: '一张空白的页面。',
  newPageDefaultName: '未命名页面',
  cancel: '取消',
  confirm: '新建',
}

const enUS: ComposeLibraryMessages = {
  recent: 'Recent',
  project: 'Projects',
  template: 'Templates',
  trash: 'Trash',
  sceneType: 'Scene type',
  uncategorized: 'Uncategorized',
  search: 'Search pages…',
  sortModified: 'Last modified',
  sortCreated: 'Newest',
  sortUsed: 'Most used',
  sortTitle: 'Name',
  viewGrid: 'Grid view',
  viewList: 'List view',
  newPage: 'New page',
  demo: 'Present',
  use: 'Use this',
  open: 'Open',
  seeAll: 'See all',
  usedTimes: (count) => `${count}×`,
  openNamed: (title) => `Open ${title}`,
  useNamed: (title) => `New page from ${title}`,
  empty: 'No pages yet',
  emptyTrash: 'Trash is empty',
  loading: 'Loading…',
  loadFailed: 'Failed to load',
  retry: 'Retry',
  loadMore: 'Load more',
  demoPosition: (index, total) => `${index} / ${total}`,
  demoPrev: 'Previous',
  demoNext: 'Next',
  demoExit: 'Exit',
  instantiateTitle: 'New page from this',
  instantiateName: 'Name',
  instantiateHint: 'Makes a copy. The two are unrelated from here on.',
  newPageTitle: 'New page',
  newPageHint: 'A blank page.',
  newPageDefaultName: 'Untitled page',
  cancel: 'Cancel',
  confirm: 'Create',
}

/** 按语言标签取一份文案；未知语言回落英文。 @internal */
export function getLibraryMessages(locale: string): ComposeLibraryMessages {
  return locale.toLowerCase().startsWith('zh') ? zhCN : enUS
}
