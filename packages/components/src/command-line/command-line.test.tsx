import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeCommandLine } from './command-line'

afterEach(cleanup)

const messages = {
  ready: '命令：',
  inputLabel: '命令行',
  placeholder: '键入命令',
  keywordsPrefix: '或',
}

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
    renderLine({ testIdPrefix: 'cad' })
    expect(screen.getByTestId('cad-command-input')).toBeInTheDocument()
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
})
