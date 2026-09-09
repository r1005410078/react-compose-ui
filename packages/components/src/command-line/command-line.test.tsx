import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeCommandLine } from './command-line'

afterEach(cleanup)

const messages = {
  ready: '命令：',
  inputLabel: '命令行',
  placeholder: '键入命令',
  keywordsPrefix: '或',
  completionsLabel: '命令列表',
}

const vocabulary = [
  { id: 'LINE', aliases: ['L'], title: '直线' },
  { id: 'CIRCLE', aliases: ['C'], title: '圆' },
  { id: 'COPY', aliases: ['CO'], title: '复制' },
  { id: 'GROUP', title: '编组', disabledReason: '请至少选中两个对象' },
] as const

function renderLine(props: Partial<Parameters<typeof ComposeCommandLine>[0]> = {}) {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  render(
    <ComposeCommandLine
      messages={messages}
      prompt={null}
      onCancel={onCancel}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return { onSubmit, onCancel }
}

describe('ComposeCommandLine', () => {
  it('空闲时显示就绪文案', () => {
    renderLine()
    expect(screen.getByTestId('compose-command-prompt')).toHaveTextContent('命令：')
  })

  it('把关键字渲染成括号里的可键入字母', () => {
    renderLine({
      prompt: {
        message: '指定下一点',
        accepts: ['point', 'keyword'] as const,
        keywords: [{ key: 'C', label: '闭合' }, { key: 'U', label: '放弃' }],
      },
    })
    expect(screen.getByTestId('compose-command-prompt'))
      .toHaveTextContent('指定下一点或 [闭合(C)/放弃(U)]:')
  })

  describe('OpenSpec: components / 命令行上报正在键入的文本与字段推进', () => {
    it('上报正在键入的文本', () => {
      const onTextChange = vi.fn()
      renderLine({ onTextChange })
      fireEvent.change(screen.getByRole('textbox', { name: '命令行' }), { target: { value: '26' } })
      expect(onTextChange).toHaveBeenLastCalledWith('26')
    })

    it('接管 Tab：上报文本、清空缓冲、焦点不动', () => {
      const onFieldAdvance = vi.fn()
      renderLine({ onFieldAdvance })
      const input = screen.getByRole('textbox', { name: '命令行' })
      input.focus()
      fireEvent.change(input, { target: { value: '260' } })

      const event = createEvent.keyDown(input, { key: 'Tab' })
      fireEvent(input, event)
      expect(onFieldAdvance).toHaveBeenCalledWith('260')
      expect(input).toHaveValue('')
      expect(event.defaultPrevented).toBe(true)
      expect(input).toHaveFocus()
    })

    it('未接管时 Tab 照常', () => {
      renderLine()
      const input = screen.getByRole('textbox', { name: '命令行' })
      // `Tab` 是键盘用户的焦点导航键，无条件劫持会把人困在输入框里。
      const event = createEvent.keyDown(input, { key: 'Tab' })
      fireEvent(input, event)
      expect(event.defaultPrevented).toBe(false)
    })
  })

  describe('OpenSpec: components / 命令行关键字可点', () => {
    it('点关键字与键入等价', () => {
      const { onSubmit } = renderLine({
        prompt: {
          message: '指定下一点',
          accepts: ['point', 'keyword'] as const,
          keywords: [{ key: 'C', label: '闭合' }, { key: 'U', label: '放弃' }],
        },
      })
      // 那一行看起来与从前一模一样：方括号、斜杠与冒号逐字保留。
      expect(screen.getByTestId('compose-command-prompt'))
        .toHaveTextContent('指定下一点或 [闭合(C)/放弃(U)]:')

      fireEvent.click(screen.getByRole('button', { name: '闭合(C)' }))
      // 宿主收到的与用户键入 `C` 回车完全一致——它不需要知道走的是哪条路。
      expect(onSubmit).toHaveBeenCalledWith('C')
    })

    it('没有关键字时不渲染按钮', () => {
      renderLine({ prompt: { message: '指定第一点', accepts: ['point'] as const } })
      expect(screen.queryByRole('button')).toBeNull()
    })
  })

  it('引导词由文案注入而不是写死', () => {
    renderLine({
      messages: { ...messages, keywordsPrefix: ' or' },
      prompt: {
        message: 'Specify next point',
        accepts: ['point', 'keyword'] as const,
        keywords: [{ key: 'U', label: 'Undo' }],
      },
    })
    expect(screen.getByTestId('compose-command-prompt'))
      .toHaveTextContent('Specify next point or [Undo(U)]:')
  })

  it('notice 取代提示', () => {
    renderLine({ notice: '未知命令', prompt: { message: '指定第一点', accepts: ['point'] } })
    expect(screen.getByTestId('compose-command-prompt')).toHaveTextContent('未知命令')
  })

  it('回车上报文本并清空输入，Esc 上报取消', () => {
    const { onSubmit, onCancel } = renderLine()
    const input = screen.getByRole('textbox', { name: '命令行' })
    fireEvent.change(input, { target: { value: 'LINE' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('LINE')
    expect(input).toHaveValue('')

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('状态标记按给出的顺序渲染，未激活的也显示', () => {
    renderLine({
      status: [
        { id: 'snap-state', label: '对象捕捉 关', active: false },
        { id: 'ortho-state', label: '正交 开', active: true },
      ],
      testIdPrefix: 'drafting',
    })
    // 二态标记关闭时也要渲染：只在开启时出现会让用户无法确认它现在是关的。
    expect(screen.getByTestId('drafting-snap-state')).toHaveTextContent('对象捕捉 关')
    expect(screen.getByTestId('drafting-snap-state')).not.toHaveAttribute('data-active')
    expect(screen.getByTestId('drafting-ortho-state')).toHaveAttribute('data-active')
  })

  it('testid 前缀由调用方给出', () => {
    renderLine({ testIdPrefix: 'drafting' })
    expect(screen.getByTestId('drafting-command-input')).toBeInTheDocument()
  })

  describe('OpenSpec: stage / 命令行历史与重复上一条 / 上箭头召回敲过的行', () => {
    /** 提交若干行；返回输入框。 */
    function submitLines(lines: readonly string[]) {
      renderLine()
      const input = screen.getByRole('textbox', { name: '命令行' })
      for (const line of lines) {
        fireEvent.change(input, { target: { value: line } })
        fireEvent.keyDown(input, { key: 'Enter' })
      }
      return input
    }

    it('上箭头依次召回更早的行，下箭头回到更近的行再回到空输入', () => {
      const input = submitLines(['LINE', '100,50', '260,130'])
      expect(input).toHaveValue('')

      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input).toHaveValue('260,130')
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input).toHaveValue('100,50')
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input).toHaveValue('LINE')

      // 到底了就停住，不绕回最近一行。
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input).toHaveValue('LINE')

      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(input).toHaveValue('100,50')
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(input).toHaveValue('260,130')
      // 走过最近一行之后回到正在编辑的那一行新的。
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(input).toHaveValue('')
    })

    it('方向键阻止默认的行内光标移动', () => {
      const input = submitLines(['LINE'])
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
      fireEvent(input, event)
      expect(event.defaultPrevented).toBe(true)
    })

    it('空行不进历史，提交后从最近一行重新开始召回', () => {
      const input = submitLines(['LINE'])
      // 空确认在宿主侧另有含义（重复上一条命令），但它不是一行可召回的文本。
      fireEvent.keyDown(input, { key: 'Enter' })

      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input).toHaveValue('LINE')
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input).toHaveValue('LINE')
    })

    it('Esc 清空输入并把召回位置退回新的一行', () => {
      const input = submitLines(['LINE', 'ARC'])
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input).toHaveValue('ARC')

      fireEvent.keyDown(input, { key: 'Escape' })
      expect(input).toHaveValue('')

      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input).toHaveValue('ARC')
    })
  })

  describe('OpenSpec: components / 命令行提示可键入的命令', () => {
    it('没有词汇表时输入框是普通 textbox，没有列表', () => {
      renderLine()
      fireEvent.change(screen.getByRole('textbox', { name: '命令行' }), { target: { value: '/' } })
      expect(screen.queryByRole('listbox')).toBeNull()
    })

    it('敲 / 列出全部命令，不可用的照样列出并标明原因', () => {
      renderLine({ completions: vocabulary })
      const input = screen.getByRole('combobox', { name: '命令行' })
      expect(input).toHaveAttribute('aria-expanded', 'false')
      fireEvent.change(input, { target: { value: '/' } })
      expect(input).toHaveAttribute('aria-expanded', 'true')
      const options = screen.getAllByRole('option')
      expect(options.map((option) => option.textContent)).toEqual([
        'LINE(L)直线',
        'CIRCLE(C)圆',
        'COPY(CO)复制',
        'GROUP编组请至少选中两个对象',
      ])
      expect(screen.getByTestId('compose-command-completion-GROUP')).toHaveAttribute('aria-disabled', 'true')
      // 第一条高亮，且经 activedescendant 关联而不是移动焦点。
      expect(options[0]).toHaveAttribute('aria-selected', 'true')
      expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id)
    })

    it('键入前缀提示匹配的命令，Enter 提交高亮那条的全名', () => {
      const { onSubmit } = renderLine({ completions: vocabulary })
      const input = screen.getByRole('combobox', { name: '命令行' })
      fireEvent.change(input, { target: { value: 'co' } })
      expect(screen.getAllByRole('option').map((option) => option.id.length > 0)).toEqual([true])
      expect(screen.getByTestId('compose-command-completion-COPY')).toBeInTheDocument()
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSubmit).toHaveBeenCalledWith('COPY')
      expect(input).toHaveValue('')
      expect(screen.queryByRole('listbox')).toBeNull()
    })

    it('方向键在列表里移动，Tab 把高亮项填进缓冲而不提交', () => {
      const { onSubmit } = renderLine({ completions: vocabulary })
      const input = screen.getByRole('combobox', { name: '命令行' })
      fireEvent.change(input, { target: { value: '/' } })
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(screen.getByTestId('compose-command-completion-COPY')).toHaveAttribute('aria-selected', 'true')
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(screen.getByTestId('compose-command-completion-CIRCLE')).toHaveAttribute('aria-selected', 'true')
      const tab = createEvent.keyDown(input, { key: 'Tab' })
      fireEvent(input, tab)
      expect(tab.defaultPrevented).toBe(true)
      expect(input).toHaveValue('CIRCLE')
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('整词别名仍解析成原来那条：敲 C 回车得到 CIRCLE 而不是 COPY', () => {
      const { onSubmit } = renderLine({ completions: vocabulary })
      const input = screen.getByRole('combobox', { name: '命令行' })
      fireEvent.change(input, { target: { value: 'C' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSubmit).toHaveBeenCalledWith('CIRCLE')
    })

    it('点一条补全与键入它的全名等价', () => {
      const { onSubmit } = renderLine({ completions: vocabulary })
      fireEvent.change(screen.getByRole('combobox', { name: '命令行' }), { target: { value: '/' } })
      fireEvent.click(screen.getByTestId('compose-command-completion-LINE'))
      expect(onSubmit).toHaveBeenCalledWith('LINE')
    })

    it('列表开着时第一级 Escape 只收起列表，不上报取消', () => {
      const { onCancel } = renderLine({ completions: vocabulary })
      const input = screen.getByRole('combobox', { name: '命令行' })
      fireEvent.change(input, { target: { value: '/li' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(input).toHaveValue('')
      expect(screen.queryByRole('listbox')).toBeNull()
      expect(onCancel).not.toHaveBeenCalled()
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('命令进行中不提示：缓冲里是坐标与关键字', () => {
      renderLine({
        completions: vocabulary,
        prompt: { message: '指定下一点', accepts: ['point', 'keyword'] as const, keywords: [{ key: 'C', label: '闭合' }] },
      })
      const input = screen.getByRole('combobox', { name: '命令行' })
      fireEvent.change(input, { target: { value: 'C' } })
      expect(screen.queryByRole('listbox')).toBeNull()
    })
  })
})
