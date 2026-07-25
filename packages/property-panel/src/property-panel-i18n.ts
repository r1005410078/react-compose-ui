import { useComposeI18nContext } from '@compose-ui/ui-context'

const translations = {
  'zh-CN': {
    region: '组件属性',
    search: '搜索属性',
    searchPlaceholder: '搜索',
    filter: '筛选属性',
    filterMenu: '属性筛选',
    all: '全部',
    modified: '已修改',
    errors: '有错误',
    settings: '属性面板设置',
    showAdvanced: '显示高级属性',
    showDescriptions: '显示字段说明',
    resetColumns: '恢复默认列宽',
    asyncUnsupported: '当前版本暂不支持异步 Valibot Schema',
    resizeLabel: '调整属性名列宽',
    resizeAction: '调整操作列宽',
    moreActions: (label: string) => `更多 ${label} 操作`,
    actions: (label: string) => `${label} 操作`,
    unknownVariable: '未知变量',
    bind: (label: string) => `绑定 ${label}`,
    replaceBinding: (label: string) => `更换绑定 ${label}`,
    closeVariablePicker: '关闭变量选择器',
    searchVariables: '搜索变量',
    pageVariables: '页面变量',
    globalVariables: '全局变量',
    noVariables: '没有兼容的变量',
    unbind: '解绑',
    presence: (label: string) => `${label} 存在`,
    reset: (label: string) => `重置 ${label}`,
    add: (label: string) => `添加 ${label}`,
    remove: (label: string) => `删除 ${label}`,
    moveUp: (label: string) => `上移 ${label}`,
    moveDown: (label: string) => `下移 ${label}`,
    recordKey: (label: string, index: number) => `${label} 键 ${index}`,
    recordValue: (label: string, key: string) => `${label} 值 ${key}`,
    unionBranch: (label: string) => `${label} 分支`,
    branch: (index: number) => `分支 ${index}`,
    issues: {
      'unknown-target': '绑定目标已不存在',
      'missing-variable': '绑定变量已不存在',
      'invalid-variable': '变量值与绑定目标不兼容',
      'invalid-root': '变量值使完整属性不符合 Schema',
    },
  },
  'en-US': {
    region: 'Component properties',
    search: 'Search properties',
    searchPlaceholder: 'Search',
    filter: 'Filter properties',
    filterMenu: 'Property filters',
    all: 'All',
    modified: 'Modified',
    errors: 'Has errors',
    settings: 'Property panel settings',
    showAdvanced: 'Show advanced properties',
    showDescriptions: 'Show field descriptions',
    resetColumns: 'Reset column widths',
    asyncUnsupported: 'Async Valibot schemas are not supported yet',
    resizeLabel: 'Resize property name column',
    resizeAction: 'Resize action column',
    moreActions: (label: string) => `More ${label} actions`,
    actions: (label: string) => `${label} actions`,
    unknownVariable: 'Unknown variable',
    bind: (label: string) => `Bind ${label}`,
    replaceBinding: (label: string) => `Change binding for ${label}`,
    closeVariablePicker: 'Close variable picker',
    searchVariables: 'Search variables',
    pageVariables: 'Page variables',
    globalVariables: 'Global variables',
    noVariables: 'No compatible variables',
    unbind: 'Unbind',
    presence: (label: string) => `${label} present`,
    reset: (label: string) => `Reset ${label}`,
    add: (label: string) => `Add ${label}`,
    remove: (label: string) => `Delete ${label}`,
    moveUp: (label: string) => `Move ${label} up`,
    moveDown: (label: string) => `Move ${label} down`,
    recordKey: (label: string, index: number) => `${label} key ${index}`,
    recordValue: (label: string, key: string) => `${label} value ${key}`,
    unionBranch: (label: string) => `${label} branch`,
    branch: (index: number) => `Branch ${index}`,
    issues: {
      'unknown-target': 'The binding target no longer exists',
      'missing-variable': 'The bound variable no longer exists',
      'invalid-variable': 'The variable value is incompatible with the binding target',
      'invalid-root': 'The variable value makes the complete properties invalid',
    },
  },
} as const

type DynamicKey =
  | 'moreActions'
  | 'actions'
  | 'bind'
  | 'replaceBinding'
  | 'presence'
  | 'reset'
  | 'add'
  | 'remove'
  | 'moveUp'
  | 'moveDown'

/** 读取 PropertyPanel 内建 chrome 文案，并应用共享消息覆盖。 */
export function usePropertyPanelMessages() {
  const i18n = useComposeI18nContext()
  const current = translations[i18n?.locale ?? 'zh-CN']
  const format = (id: string, fallback: string, variables?: Record<string, string | number>) =>
    i18n?.formatMessage(`propertyPanel.${id}`, fallback, variables) ?? fallback
  const dynamic = (key: DynamicKey, label: string) =>
    format(key, current[key](label), { label })
  return {
    region: format('region', current.region),
    search: format('search', current.search),
    searchPlaceholder: format('searchPlaceholder', current.searchPlaceholder),
    filter: format('filter', current.filter),
    filterMenu: format('filterMenu', current.filterMenu),
    all: format('all', current.all),
    modified: format('modified', current.modified),
    errors: format('errors', current.errors),
    settings: format('settings', current.settings),
    showAdvanced: format('showAdvanced', current.showAdvanced),
    showDescriptions: format('showDescriptions', current.showDescriptions),
    resetColumns: format('resetColumns', current.resetColumns),
    asyncUnsupported: format('asyncUnsupported', current.asyncUnsupported),
    resizeLabel: format('resizeLabel', current.resizeLabel),
    resizeAction: format('resizeAction', current.resizeAction),
    moreActions: (label: string) => dynamic('moreActions', label),
    actions: (label: string) => dynamic('actions', label),
    unknownVariable: format('unknownVariable', current.unknownVariable),
    bind: (label: string) => dynamic('bind', label),
    replaceBinding: (label: string) => dynamic('replaceBinding', label),
    closeVariablePicker: format('closeVariablePicker', current.closeVariablePicker),
    searchVariables: format('searchVariables', current.searchVariables),
    pageVariables: format('pageVariables', current.pageVariables),
    globalVariables: format('globalVariables', current.globalVariables),
    noVariables: format('noVariables', current.noVariables),
    unbind: format('unbind', current.unbind),
    presence: (label: string) => dynamic('presence', label),
    reset: (label: string) => dynamic('reset', label),
    add: (label: string) => dynamic('add', label),
    remove: (label: string) => dynamic('remove', label),
    moveUp: (label: string) => dynamic('moveUp', label),
    moveDown: (label: string) => dynamic('moveDown', label),
    recordKey: (label: string, index: number) => format(
      'recordKey',
      current.recordKey(label, index),
      { label, index },
    ),
    recordValue: (label: string, key: string) => format(
      'recordValue',
      current.recordValue(label, key),
      { label, key },
    ),
    unionBranch: (label: string) => format(
      'unionBranch',
      current.unionBranch(label),
      { label },
    ),
    branch: (index: number) => format('branch', current.branch(index), { index }),
    issue: (code: keyof typeof current.issues) =>
      format(`issue.${code}`, current.issues[code]),
  }
}
