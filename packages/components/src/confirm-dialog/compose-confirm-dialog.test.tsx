import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ComposeConfirmDialog } from './compose-confirm-dialog'

describe('ComposeConfirmDialog', () => {
  it('OpenSpec: components / 共享确认对话框 / 取消危险操作', () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(<ComposeConfirmDialog cancelLabel="取消" confirmLabel="删除" description="不可恢复" destructive open title="确认删除" onConfirm={onConfirm} onOpenChange={onOpenChange} />)
    expect(screen.getByRole('alertdialog')).toHaveAttribute('data-compose-ui', 'confirm-dialog')
    expect(screen.getByRole('button', { name: '删除' })).toHaveAttribute('data-danger', 'true')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
