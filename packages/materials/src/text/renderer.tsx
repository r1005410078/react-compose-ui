import type {
  ComposeRendererProps,
  ComposeRendererTextEditing,
} from '@compose-ui/component-registry'
import { useEffect, useRef, type ClipboardEvent, type CSSProperties } from 'react'

function textAlign(value: unknown): CSSProperties['textAlign'] {
  return value === 'center' || value === 'right' || value === 'justify' ? value : 'left'
}

function verticalAlign(value: unknown): CSSProperties['alignItems'] {
  // 缺少该字段的旧文档沿用旧 renderer 的垂直居中；新 Text 会显式写入 top。
  if (value === 'top') return 'flex-start'
  if (value === 'bottom') return 'flex-end'
  return 'center'
}

function textTransform(value: unknown): CSSProperties['textTransform'] {
  return value === 'uppercase' || value === 'lowercase' || value === 'capitalize'
    ? value
    : 'none'
}

function textDecoration(value: unknown): CSSProperties['textDecorationLine'] {
  return value === 'underline' || value === 'line-through' ? value : 'none'
}

/**
 * 编辑态的可编辑文本节点。
 *
 * 内容是**非受控**的：只在挂载时播种一次，之后完全由 DOM 拥有。Auto width 每次输入都会
 * 重排，重排引起的重渲染若用 props 回写 textContent，会把用户刚敲的字覆盖掉，光标也会跳到
 * 末尾。宿主只通过 onChange 收集纯文本，提交时机由它掌握。
 */
function TextEditable({
  seed,
  onChange,
}: {
  readonly seed: string
  readonly onChange: ComposeRendererTextEditing['onChange']
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.textContent = seed
    const view = node.ownerDocument.defaultView
    // 双击进入时，本次 pointerdown 的浏览器默认动作会在 React 同步 commit 之后才把焦点
    // 挪走；此处若立即 focus 会被它清掉，焦点落到 body，键盘输入全部丢失。推迟一帧，
    // 让默认动作先跑完。
    const focusNode = () => {
      node.focus()
      // 光标落到文末，与主流设计工具进入编辑后的行为一致。
      const selection = view?.getSelection()
      if (!selection) return
      const range = node.ownerDocument.createRange()
      range.selectNodeContents(node)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    if (!view?.requestAnimationFrame) {
      focusNode()
      return
    }
    const frame = view.requestAnimationFrame(focusNode)
    return () => view.cancelAnimationFrame(frame)
    // 只在挂载时播种：seed 变化不应回写，否则会覆盖编辑中的内容。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 见上方说明，seed 只作初值
  }, [])

  const pastePlainText = (event: ClipboardEvent<HTMLSpanElement>) => {
    // 文档协议里 text 是纯文本单 Prop，富文本必须在进入 DOM 之前就被剥掉，
    // 之后再读 textContent 已经晚了——标记已经进了 DOM 树。
    event.preventDefault()
    const node = event.currentTarget
    const plain = event.clipboardData.getData('text/plain')
    // 用 Range 而不是 execCommand：后者已废弃，且在无 contentEditable 实现的环境里不存在。
    const selection = node.ownerDocument.defaultView?.getSelection()
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
    if (range && node.contains(range.commonAncestorContainer)) {
      range.deleteContents()
      const inserted = node.ownerDocument.createTextNode(plain)
      range.insertNode(inserted)
      range.setStartAfter(inserted)
      range.collapse(true)
      selection!.removeAllRanges()
      selection!.addRange(range)
    }
    else {
      node.textContent = `${node.textContent ?? ''}${plain}`
    }
    onChange(node.textContent ?? '')
  }

  return (
    <span
      className="compose-material--text-content"
      contentEditable
      data-testid="compose-material-text-editable"
      ref={ref}
      role="textbox"
      suppressContentEditableWarning
      tabIndex={0}
      onInput={(event) => onChange(event.currentTarget.textContent ?? '')}
      onPaste={pastePlainText}
    />
  )
}

/** Materials 内置 Text renderer。 @internal */
export function TextRenderer({ props, textEditing }: ComposeRendererProps) {
  const fontWeight = typeof props.fontWeight === 'string' || typeof props.fontWeight === 'number'
    ? props.fontWeight as CSSProperties['fontWeight']
    : undefined
  return (
    <div
      className="compose-material compose-material--text"
      data-testid="compose-material-text"
      style={{
        alignItems: verticalAlign(props.verticalAlign),
        color: typeof props.color === 'string' ? props.color : '#ffffff',
        fontFamily: typeof props.fontFamily === 'string' ? props.fontFamily : undefined,
        fontSize: typeof props.fontSize === 'number' ? props.fontSize : undefined,
        fontWeight,
        letterSpacing: typeof props.letterSpacing === 'number' ? props.letterSpacing : undefined,
        lineHeight: typeof props.lineHeight === 'number' ? `${props.lineHeight}px` : undefined,
        textAlign: textAlign(props.textAlign),
        textDecorationLine: textDecoration(props.textDecoration),
        textTransform: textTransform(props.textCase),
        fontVariantCaps: props.textCase === 'small-caps' ? 'small-caps' : 'normal',
      }}
    >
      {/* 编辑态只替换内容节点，容器排版样式原样保留，退出编辑时视觉不跳变。 */}
      {textEditing
        ? <TextEditable onChange={textEditing.onChange} seed={textEditing.value} />
        : (
            <span className="compose-material--text-content">
              {typeof props.text === 'string' || typeof props.text === 'number' ? props.text : 'Text'}
            </span>
          )}
    </div>
  )
}
