import type { ReactNode } from 'react'
import { AddIcon } from './icons'
import { getSceneTreeMessages } from './scene-tree-i18n'
import type { SceneTreeMessages } from './scene-tree-i18n'

interface SearchToggleProps {
  active: boolean
  children: ReactNode
  label: string
  onClick: () => void
}

function SearchToggle({ active, children, label, onClick }: SearchToggleProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`st:mx-px st:grid st:h-5 st:min-w-5 st:cursor-pointer st:place-items-center st:rounded-sm st:border-0 st:px-0.5 st:!text-[11px] st:focus-visible:outline-1 st:focus-visible:outline-[#75beff] ${active ? 'st:bg-[#094771] st:text-white st:shadow-[inset_0_0_0_1px_#007acc]' : 'st:bg-transparent st:text-[#aeb5be] st:hover:bg-[#2a2d2e] st:hover:text-white'}`}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

interface SceneTreeToolbarProps {
  /** 新增按钮是不是一个菜单触发器；true 时它声明 `aria-haspopup` 并按 `addMenuOpen` 报展开态。 */
  addMenu?: boolean
  addMenuOpen?: boolean
  caseSensitive: boolean
  error: string | null
  /** 新增按钮被激活；`addMenu` 为 true 时参数是按钮元素，供调用方按它的矩形定位菜单。 */
  onAdd: (trigger: HTMLButtonElement) => void
  onCaseSensitiveChange: () => void
  onQueryChange: (query: string) => void
  onRegexChange: () => void
  onWholeWordChange: () => void
  query: string
  regex: boolean
  wholeWord: boolean
  messages?: SceneTreeMessages
}

/** 无状态的新增与检索工具栏。 */
export function SceneTreeToolbar({
  addMenu = false,
  addMenuOpen = false,
  caseSensitive,
  error,
  onAdd,
  onCaseSensitiveChange,
  onQueryChange,
  onRegexChange,
  onWholeWordChange,
  query,
  regex,
  wholeWord,
  messages = getSceneTreeMessages('zh-CN'),
}: SceneTreeToolbarProps) {
  return (
    <>
      <div className="st:flex st:h-8 st:shrink-0 st:items-center st:gap-1 st:border-b st:border-[#282e36] st:px-1">
        <div className="st:flex st:h-6 st:min-w-0 st:flex-1 st:items-center st:rounded-[3px] st:border st:border-[#343b44] st:bg-[#15181d] st:focus-within:border-[#007acc] st:focus-within:ring-1 st:focus-within:ring-[#007acc]">
          <input
            aria-invalid={error ? 'true' : undefined}
            aria-label={messages.searchNodes}
            className="st:h-full st:w-0 st:min-w-0 st:flex-1 st:cursor-text st:border-0 st:bg-transparent st:px-1.5 st:!text-[11px] st:text-[#e1e5eb] st:outline-none st:placeholder:text-[#77818d]"
            placeholder={messages.searchPlaceholder}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <SearchToggle active={caseSensitive} label={messages.caseSensitive} onClick={onCaseSensitiveChange}>Aa</SearchToggle>
          <SearchToggle active={wholeWord} label={messages.wholeWord} onClick={onWholeWordChange}><span className="st:underline">ab</span></SearchToggle>
          <SearchToggle active={regex} label={messages.regex} onClick={onRegexChange}>.*</SearchToggle>
        </div>
        {/*
          * 同一颗按钮在两种宿主配置下含义不同——一种当场建东西、一种弹菜单——因此它得把自己
          * 是哪一种说出来，否则读屏用户按下去才知道。
          */}
        <button
          aria-expanded={addMenu ? addMenuOpen : undefined}
          aria-haspopup={addMenu ? 'menu' : undefined}
          aria-label={messages.addNode}
          className="st:grid st:size-6 st:shrink-0 st:cursor-pointer st:place-items-center st:rounded-[3px] st:border-0 st:bg-transparent st:p-0 st:text-[#b9c1cc] st:hover:bg-[#2a2d2e] st:hover:text-white st:focus-visible:outline-1 st:focus-visible:outline-offset-1 st:focus-visible:outline-[#2388ff]"
          title={messages.addNode}
          type="button"
          onClick={(event) => onAdd(event.currentTarget)}
        >
          <AddIcon className="st:block st:size-[14px] st:stroke-current st:stroke-[1.6]" />
        </button>
      </div>
      {error ? (
        <div className="st:px-3 st:py-1 st:text-xs st:text-[#ff7b86]" role="alert">
          {error}
        </div>
      ) : null}
    </>
  )
}
