import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  OperationLogPanel,
  OperationLogProvider,
  createMemoryOperationLogStore,
  useOperationLog,
} from './index'
import type { OperationLogEntry, OperationLogStore } from './index'

afterEach(cleanup)

function entry(overrides: Partial<OperationLogEntry> = {}): OperationLogEntry {
  return {
    id: 'entry-1',
    scopeId: 'workspace-a',
    sessionId: 'session-a',
    action: 'property.change',
    category: 'property',
    summary: '修改矩形宽度',
    targets: [{ componentId: 'rectangle-1', componentLabel: '矩形', path: ['size', 'width'] }],
    before: { status: 'complete', preview: '100', byteLength: 3, value: 100 },
    after: { status: 'complete', preview: '120', byteLength: 3, value: 120 },
    startedAt: 100,
    updatedAt: 100,
    count: 1,
    ...overrides,
  }
}

function StatusAndRecorder() {
  const log = useOperationLog()
  return (
    <>
      <output aria-label="日志状态">{log.status}</output>
      <button
        type="button"
        onClick={() => void log.record({
          action: 'component.create',
          category: 'component',
          summary: '新增文本组件',
          targets: [{ componentId: 'text-1', componentLabel: '文本' }],
          after: { id: 'text-1' },
        })}
      >
        记录
      </button>
    </>
  )
}

describe('OpenSpec: operation-log / Scoped IndexedDB 持久化 / 刷新后恢复当前 scope', () => {
  it('从 store 恢复日志并把成功记录同步给订阅者', async () => {
    const store = createMemoryOperationLogStore()
    await store.put(entry())

    render(
      <OperationLogProvider scopeId="workspace-a" store={store}>
        <StatusAndRecorder />
        <OperationLogPanel />
      </OperationLogProvider>,
    )

    const list = await screen.findByLabelText('Operation list')
    expect(within(list).getByText('修改矩形宽度')).toBeInTheDocument()
    expect(screen.getByLabelText('日志状态')).toHaveTextContent('ready')

    fireEvent.click(screen.getByRole('button', { name: '记录' }))
    expect(await within(list).findByText('新增文本组件')).toBeInTheDocument()
    expect((await store.load('workspace-a')).map(({ action }) => action)).toContain('component.create')
  })

  it('scope 改变时只展示新 scope 的记录', async () => {
    const store = createMemoryOperationLogStore()
    await store.put(entry())
    await store.put(entry({ id: 'entry-b', scopeId: 'workspace-b', summary: '移动图表' }))
    function Harness() {
      const [scopeId, setScopeId] = useState('workspace-a')
      return (
        <>
          <button type="button" onClick={() => setScopeId('workspace-b')}>切换</button>
          <OperationLogProvider scopeId={scopeId} store={store}>
            <OperationLogPanel />
          </OperationLogProvider>
        </>
      )
    }
    render(<Harness />)
    expect(within(await screen.findByLabelText('Operation list')).getByText('修改矩形宽度')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '切换' }))
    const list = await screen.findByLabelText('Operation list')
    expect(within(list).getByText('移动图表')).toBeInTheDocument()
    expect(within(list).queryByText('修改矩形宽度')).not.toBeInTheDocument()
  })
})

describe('OpenSpec: operation-log / Scoped IndexedDB 持久化 / IndexedDB 不可用时降级', () => {
  it('显示持久化不可用状态并继续保留当前会话日志', async () => {
    const error = new Error('storage failed')
    const store: OperationLogStore = {
      load: vi.fn().mockRejectedValue(error),
      put: vi.fn().mockRejectedValue(error),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    }
    const onStorageError = vi.fn()
    render(
      <OperationLogProvider scopeId="workspace-a" store={store} onStorageError={onStorageError}>
        <StatusAndRecorder />
        <OperationLogPanel />
      </OperationLogProvider>,
    )

    expect(await screen.findByText('Local persistence unavailable')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '记录' }))
    expect(within(await screen.findByLabelText('Operation list')).getByText('新增文本组件')).toBeInTheDocument()
    expect(screen.getByLabelText('日志状态')).toHaveTextContent('degraded')
    expect(onStorageError).toHaveBeenCalledWith(error)
  })
})

describe('OpenSpec: operation-log / 可访问日志查看面板 / 搜索和筛选日志', () => {
  it('支持搜索、分类、组件筛选和可访问详情', async () => {
    const store = createMemoryOperationLogStore()
    await store.put(entry())
    await store.put(entry({
      id: 'entry-2',
      category: 'scene',
      action: 'scene.move',
      summary: '移动图表层级',
      targets: [{ componentId: 'chart-1', componentLabel: '图表' }],
      before: undefined,
      after: undefined,
      updatedAt: 200,
    }))
    render(
      <OperationLogProvider scopeId="workspace-a" store={store}>
        <OperationLogPanel aria-label="操作日志" />
      </OperationLogProvider>,
    )
    const panel = await screen.findByRole('region', { name: '操作日志' })
    expect(within(within(panel).getByLabelText('Operation category')).getAllByRole('option')).toHaveLength(5)

    fireEvent.change(within(panel).getByLabelText('Operation category'), { target: { value: 'scene' } })
    const list = within(panel).getByLabelText('Operation list')
    expect(within(list).getByText('移动图表层级')).toBeInTheDocument()
    expect(within(list).queryByText('修改矩形宽度')).not.toBeInTheDocument()

    fireEvent.change(within(panel).getByLabelText('Operation category'), { target: { value: 'all' } })
    fireEvent.change(within(panel).getByLabelText('Operation component'), { target: { value: 'rectangle-1' } })
    expect(within(list).getByText('修改矩形宽度')).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: /修改矩形宽度/ }))
    expect(within(panel).getByRole('region', { name: 'Operation details' })).toHaveTextContent('size.width')
    expect(within(panel).getByText('100')).toBeInTheDocument()
    expect(within(panel).getByText('120')).toBeInTheDocument()

    fireEvent.change(within(panel).getByLabelText('Search operations'), { target: { value: '不存在' } })
    expect(within(panel).getByText('No matching operations')).toBeInTheDocument()
  })

  it('初始加载结束后显示空状态', async () => {
    render(
      <OperationLogProvider scopeId="empty" store={createMemoryOperationLogStore()}>
        <OperationLogPanel />
      </OperationLogProvider>,
    )
    await waitFor(() => expect(screen.getByText('No operations yet')).toBeInTheDocument())
  })

})

describe('OpenSpec: operation-log / 可访问日志查看面板 / 查看结构化详情', () => {
  it('明确说明截断和不可保存的快照', async () => {
    const store = createMemoryOperationLogStore()
    await store.put(entry({
      before: { status: 'truncated', preview: '{"large":…', byteLength: 70000 },
      after: {
        status: 'unavailable',
        preview: 'Unavailable: Circular reference detected',
        byteLength: 0,
        reason: '检测到循环引用',
      },
    }))
    render(
      <OperationLogProvider scopeId="workspace-a" store={store}>
        <OperationLogPanel />
      </OperationLogProvider>,
    )

    const list = await screen.findByLabelText('Operation list')
    fireEvent.click(within(list).getByRole('button', { name: /修改矩形宽度/ }))
    const detail = screen.getByRole('region', { name: 'Operation details' })
    expect(detail).toHaveTextContent('Truncated · 70000 B')
    expect(detail).toHaveTextContent('Unavailable')
    expect(detail).toHaveTextContent('Circular reference detected')
  })
})
