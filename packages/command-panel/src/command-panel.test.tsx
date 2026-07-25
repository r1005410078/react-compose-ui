import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  createDefaultCanvasSettings,
  createTransactionRuntime,
  type CommandHandler,
  type ComposeDocument,
  type EditorCommand,
} from '@compose-ui/core'
import { afterEach, describe, expect, it } from 'vitest'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import * as commandPanelPackage from './index'

type Preset = {
  id: string
  label: string
  fields: readonly {
    name: string
    label: string
    type: 'string' | 'number' | 'boolean' | 'select' | 'json'
    required?: boolean
    options?: readonly { value: string; label: string }[]
  }[]
  createCommand(values: Readonly<Record<string, unknown>>): EditorCommand
}

const CommandPanel = (
  commandPanelPackage as unknown as {
    CommandPanel(props: {
      runtime: ReturnType<typeof createTransactionRuntime>
      presets?: readonly Preset[]
      eventLimit?: number
      locale?: 'zh-CN' | 'en-US'
      'aria-label'?: string
    }): React.ReactNode
  }
).CommandPanel

afterEach(cleanup)

function fixture(): ComposeDocument {
  return {
    schemaVersion: 2,
    canvas: createDefaultCanvasSettings(),
    rootIds: ['frame'],
    nodes: {
      frame: {
        id: 'frame',
        kind: 'frame',
        name: 'Frame',
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
        childIds: ['a'],
      },
      a: {
        id: 'a',
        kind: 'component',
        name: 'A',
        visible: true,
        locked: false,
        transform: { x: 10, y: 20, width: 100, height: 50, rotation: 0 },
        componentType: 'text',
        props: { text: 'A' },
      },
    },
  }
}

function runtime() {
  const rename: CommandHandler = {
    type: 'fixture.rename',
    execute: (_document, command) => command.payload.name === 'reject'
      ? {
          status: 'rejected',
          issues: [{ code: 'fixture.rejected', message: '名称被拒绝' }],
        }
      : {
          status: 'patches',
          patches: [{
            op: 'set',
            path: ['nodes', 'a', 'name'],
            value: command.payload.name,
          }],
        },
  }
  return createTransactionRuntime({
    document: fixture(),
    handlers: [rename],
    idFactory: () => 'transaction-a',
    clock: () => 100,
  })
}

function renameCommand(name: string, mergeKey?: string): EditorCommand {
  return {
    id: `rename-${name}`,
    type: 'fixture.rename',
    payload: { name },
    meta: { label: '修改名称', source: 'test', targetIds: ['a'], mergeKey },
  }
}

describe('CommandPanel', () => {
  it('OpenSpec: command-panel / 独立结构化命令调试台 / 显示三种命令结果', () => {
    const controller = runtime()
    render(<CommandPanel runtime={controller} aria-label="命令调试台" />)

    act(() => {
      controller.dispatch(renameCommand('Committed'))
      controller.dispatch(renameCommand('Committed'))
      controller.dispatch(renameCommand('reject'))
    })

    expect(screen.getByRole('region', { name: '命令调试台' })).toBeInTheDocument()
    expect(screen.getByText('成功')).toBeInTheDocument()
    expect(screen.getByText('无变化')).toBeInTheDocument()
    expect(screen.getByText('已拒绝')).toBeInTheDocument()
    expect(screen.getByText('名称被拒绝')).toBeInTheDocument()
    expect(screen.getAllByText('test')).toHaveLength(3)
  })

  it('OpenSpec: command-panel / 独立结构化命令调试台 / 限制会话事件数量', () => {
    const controller = runtime()
    render(<CommandPanel eventLimit={2} runtime={controller} />)

    act(() => {
      controller.dispatch(renameCommand('One'))
      controller.dispatch(renameCommand('Two'))
      controller.dispatch(renameCommand('Three'))
    })

    expect(screen.queryByText('rename-One')).not.toBeInTheDocument()
    expect(screen.getByText('rename-Two')).toBeInTheDocument()
    expect(screen.getByText('rename-Three')).toBeInTheDocument()
  })

  it('OpenSpec: command-panel / 独立结构化命令调试台 / 更换运行时', () => {
    const first = runtime()
    const second = runtime()
    const view = render(<CommandPanel runtime={first} />)
    act(() => first.dispatch(renameCommand('First')))
    expect(screen.getByText('rename-First')).toBeInTheDocument()

    view.rerender(<CommandPanel runtime={second} />)
    act(() => {
      first.dispatch(renameCommand('Old'))
      second.dispatch(renameCommand('Second'))
    })

    expect(screen.queryByText('rename-First')).not.toBeInTheDocument()
    expect(screen.queryByText('rename-Old')).not.toBeInTheDocument()
    expect(screen.getByText('rename-Second')).toBeInTheDocument()
  })

  it('OpenSpec: command-panel / 事务详情 / 查看成功事务', () => {
    const controller = runtime()
    render(<CommandPanel runtime={controller} />)
    act(() => controller.dispatch(renameCommand('Detail')))

    fireEvent.click(screen.getByRole('button', { name: '查看 修改名称 详情' }))

    expect(screen.getByText('transaction-a')).toBeInTheDocument()
    expect(screen.getAllByText('test')).toHaveLength(2)
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Forward patches' })).toHaveTextContent(
      /nodes.*a.*name/,
    )
    expect(screen.getByRole('list', { name: 'Inverse patches' })).toHaveTextContent(
      /nodes.*a.*name/,
    )
  })

  it('OpenSpec: command-panel / 事务详情 / 查看合并事务', () => {
    let now = 100
    let id = 0
    const controller = createTransactionRuntime({
      document: fixture(),
      clock: () => now,
      idFactory: () => `transaction-${id++}`,
      handlers: [{
        type: 'fixture.rename',
        execute: (_document, command) => ({
          status: 'patches',
          patches: [{ op: 'set', path: ['nodes', 'a', 'name'], value: command.payload.name }],
        }),
      }],
    })
    render(<CommandPanel runtime={controller} />)
    act(() => {
      controller.dispatch(renameCommand('First', 'a:name'))
      now += 100
      controller.dispatch(renameCommand('Last', 'a:name'))
    })

    expect(screen.getAllByText('transaction-0')).toHaveLength(1)
    expect(screen.getByText('已合并')).toBeInTheDocument()
  })

  it('OpenSpec: command-panel / 命令预设表单 / 派发有效预设', () => {
    const controller = runtime()
    const preset: Preset = {
      id: 'rename',
      label: '重命名',
      fields: [
        { name: 'name', label: '名称', type: 'string', required: true },
        { name: 'count', label: '次数', type: 'number', required: true },
        { name: 'visible', label: '可见', type: 'boolean' },
        {
          name: 'mode',
          label: '模式',
          type: 'select',
          options: [{ value: 'safe', label: '安全' }],
          required: true,
        },
        { name: 'metadata', label: '元数据', type: 'json', required: true },
      ],
      createCommand(values) {
        expect(values).toEqual({
          name: 'Preset',
          count: 2,
          visible: true,
          mode: 'safe',
          metadata: { source: 'form' },
        })
        return renameCommand(values.name as string)
      },
    }
    render(<CommandPanel presets={[preset]} runtime={controller} />)

    fireEvent.change(screen.getByRole('textbox', { name: '名称' }), {
      target: { value: 'Preset' },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: '次数' }), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: '可见' }))
    fireEvent.change(screen.getByRole('combobox', { name: '模式' }), {
      target: { value: 'safe' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '元数据' }), {
      target: { value: '{"source":"form"}' },
    })
    fireEvent.click(screen.getByRole('button', { name: '执行重命名' }))

    expect(controller.document.nodes.a.name).toBe('Preset')
  })

  it('OpenSpec: command-panel / 命令预设表单 / 阻止无效预设输入', () => {
    const controller = runtime()
    const preset: Preset = {
      id: 'invalid',
      label: '校验',
      fields: [
        { name: 'name', label: '名称', type: 'string', required: true },
        { name: 'count', label: '次数', type: 'number', required: true },
        { name: 'metadata', label: '元数据', type: 'json', required: true },
      ],
      createCommand() {
        throw new Error('invalid form must not call factory')
      },
    }
    render(<CommandPanel presets={[preset]} runtime={controller} />)

    fireEvent.change(screen.getByRole('spinbutton', { name: '次数' }), {
      target: { value: 'Infinity' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '元数据' }), {
      target: { value: '{bad}' },
    })
    fireEvent.click(screen.getByRole('button', { name: '执行校验' }))

    expect(screen.getByText('名称为必填项')).toBeInTheDocument()
    expect(screen.getByText('次数必须是有限数字')).toBeInTheDocument()
    expect(screen.getByText('元数据必须是有效 JSON')).toBeInTheDocument()
    expect(controller.entries).toHaveLength(1)
  })

  it('OpenSpec: command-panel / 独立结构化命令调试台 / 限制会话事件数量 - 默认容量', () => {
    const controller = runtime()
    render(<CommandPanel runtime={controller} />)

    act(() => {
      for (let index = 0; index <= 100; index += 1) {
        controller.dispatch(renameCommand(`Event ${index}`))
      }
    })

    expect(screen.queryByText('rename-Event 0')).not.toBeInTheDocument()
    expect(screen.getByText('rename-Event 100')).toBeInTheDocument()
  })

  it('OpenSpec: command-panel / 调试台可访问性与样式 / 键盘检查并派发命令', () => {
    const controller = runtime()
    const preset: Preset = {
      id: 'keyboard',
      label: '键盘命令',
      fields: [{ name: 'name', label: '键盘名称', type: 'string', required: true }],
      createCommand(values) {
        return renameCommand(values.name as string)
      },
    }
    render(<CommandPanel presets={[preset]} runtime={controller} />)

    const input = screen.getByRole('textbox', { name: '键盘名称' })
    input.focus()
    expect(input).toHaveFocus()
    fireEvent.change(input, { target: { value: 'Keyboard' } })
    fireEvent.submit(screen.getByRole('button', { name: '执行键盘命令' }).closest('form')!)

    const details = screen.getByRole('button', { name: '查看 修改名称 详情' })
    details.focus()
    expect(details).toHaveFocus()
    fireEvent.click(details)
    expect(details).toHaveAttribute('aria-expanded', 'true')
    expect(controller.document.nodes.a.name).toBe('Keyboard')
  })

  it('OpenSpec: command-panel / 命令面板内建本地化 / 使用英文命令面板', () => {
    const controller = runtime()
    const preset: Preset = {
      id: 'english',
      label: '宿主预设',
      fields: [{ name: 'name', label: '宿主名称', type: 'string', required: true }],
      createCommand(values) {
        return renameCommand(values.name as string)
      },
    }
    render(<CommandPanel locale="en-US" presets={[preset]} runtime={controller} />)

    expect(screen.getByRole('region', { name: 'Command debugger' })).toBeInTheDocument()
    expect(screen.getByText('No command events')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Run 宿主预设' }))
    expect(screen.getByText('宿主名称 is required')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: '宿主名称' }), {
      target: { value: 'English' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Run 宿主预设' }))
    expect(screen.getByText('Succeeded')).toBeInTheDocument()
    expect(screen.getByText('修改名称')).toBeInTheDocument()
  })

  it('OpenSpec: command-panel / 命令面板内建本地化 / 独立使用默认语言', () => {
    render(<CommandPanel runtime={runtime()} />)
    expect(screen.getByRole('region', { name: '命令调试台' })).toBeInTheDocument()
    expect(screen.getByText('暂无命令事件')).toBeInTheDocument()
  })

  it('OpenSpec: ui-context / 共享 UI Context 包 / 独立组件保持兼容 - CommandPanel 消费 Context', () => {
    const runtime = createTransactionRuntime({ document: fixture() })
    render(
      <ComposeUIProvider locale="en-US" theme="light">
        <CommandPanel presets={[]} runtime={runtime} />
      </ComposeUIProvider>,
    )

    expect(screen.getByText('No command events')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Command debugger' }))
      .toHaveAttribute('data-compose-theme', 'light')
  })
})
