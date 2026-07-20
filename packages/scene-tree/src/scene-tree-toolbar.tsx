import type { ReactNode } from 'react'
import { AddIcon } from './icons'

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
  caseSensitive: boolean
  error: string | null
  onAdd: () => void
  onCaseSensitiveChange: () => void
  onQueryChange: (query: string) => void
  onRegexChange: () => void
  onWholeWordChange: () => void
  query: string
  regex: boolean
  wholeWord: boolean
}

/** 无状态的新增与检索工具栏。 */
export function SceneTreeToolbar({
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
}: SceneTreeToolbarProps) {
  return (
    <>
      <div className="st:flex st:h-8 st:shrink-0 st:items-center st:gap-1 st:border-b st:border-[#282e36] st:px-1">
        <button
          aria-label="新增节点"
          className="st:grid st:size-6 st:shrink-0 st:cursor-pointer st:place-items-center st:rounded-[3px] st:border-0 st:bg-transparent st:p-0 st:text-[#b9c1cc] st:hover:bg-[#2a2d2e] st:hover:text-white st:focus-visible:outline-1 st:focus-visible:outline-offset-1 st:focus-visible:outline-[#2388ff]"
          title="新增节点"
          type="button"
          onClick={onAdd}
        >
          <AddIcon className="st:block st:size-[14px] st:stroke-current st:stroke-[1.6]" />
        </button>
        <div className="st:flex st:h-6 st:min-w-0 st:flex-1 st:items-center st:rounded-[3px] st:border st:border-[#343b44] st:bg-[#15181d] st:focus-within:border-[#007acc] st:focus-within:ring-1 st:focus-within:ring-[#007acc]">
          <input
            aria-invalid={error ? 'true' : undefined}
            aria-label="搜索节点"
            className="st:h-full st:w-0 st:min-w-0 st:flex-1 st:cursor-text st:border-0 st:bg-transparent st:px-1.5 st:!text-[11px] st:text-[#e1e5eb] st:outline-none st:placeholder:text-[#77818d]"
            placeholder="搜索"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <SearchToggle active={caseSensitive} label="大小写敏感" onClick={onCaseSensitiveChange}>Aa</SearchToggle>
          <SearchToggle active={wholeWord} label="全词匹配" onClick={onWholeWordChange}><span className="st:underline">ab</span></SearchToggle>
          <SearchToggle active={regex} label="正则表达式" onClick={onRegexChange}>.*</SearchToggle>
        </div>
      </div>
      {error ? (
        <div className="st:px-3 st:py-1 st:text-xs st:text-[#ff7b86]" role="alert">
          {error}
        </div>
      ) : null}
    </>
  )
}
