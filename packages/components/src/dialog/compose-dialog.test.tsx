import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ComposeThemeProvider } from '@compose-ui/ui-context'
import {
  ComposeDialog,
  ComposeDialogBackdrop,
  ComposeDialogClose,
  ComposeDialogContent,
  ComposeDialogDescription,
  ComposeDialogPortal,
  ComposeDialogTitle,
  ComposeDialogTrigger,
  ComposeDialogViewport,
} from './compose-dialog'

function DialogFixture() {
  return (
    <div className="test-clipped-panel" style={{ overflow: 'hidden', position: 'relative' }}>
      <ComposeDialog>
        <ComposeDialogTrigger>打开弹框</ComposeDialogTrigger>
        <ComposeDialogPortal>
          <ComposeDialogBackdrop data-testid="dialog-backdrop" />
          <ComposeDialogViewport data-testid="dialog-viewport">
            <ComposeDialogContent>
              <ComposeDialogTitle>新建文件</ComposeDialogTitle>
              <ComposeDialogDescription>请输入资源名称</ComposeDialogDescription>
              <ComposeDialogClose>取消</ComposeDialogClose>
            </ComposeDialogContent>
          </ComposeDialogViewport>
        </ComposeDialogPortal>
      </ComposeDialog>
    </div>
  )
}

describe('ComposeDialog', () => {
  afterEach(() => cleanup())

  it('OpenSpec: components / 全视口 Compose Dialog / 从裁剪容器打开 Dialog', async () => {
    render(<DialogFixture />)

    const trigger = screen.getByRole('button', { name: '打开弹框' })
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: '新建文件' })
    expect(dialog).toHaveAttribute('data-compose-ui', 'dialog')
    expect(dialog.closest('.test-clipped-panel')).toBeNull()
    expect(screen.getByTestId('dialog-backdrop')).toHaveClass('cu:fixed', 'cu:inset-0')
    expect(screen.getByTestId('dialog-viewport')).toHaveClass('cu:fixed', 'cu:inset-0')

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '新建文件' })).toBeNull())
    expect(trigger).toHaveFocus()
  })

  it('OpenSpec: components / 全视口 Compose Dialog / 在 Portal 中继承 Compose 外观', () => {
    render(
      <ComposeThemeProvider theme="light">
        <DialogFixture />
      </ComposeThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开弹框' }))
    expect(screen.getByRole('dialog', { name: '新建文件' })).toHaveAttribute(
      'data-compose-theme',
      'light',
    )
  })

  it('OpenSpec: components / 全视口 Compose Dialog / 遮罩按压关闭并恢复触发器焦点', async () => {
    render(<DialogFixture />)
    const trigger = screen.getByRole('button', { name: '打开弹框' })
    fireEvent.click(trigger)

    fireEvent.mouseDown(screen.getByTestId('dialog-backdrop'))
    fireEvent.click(screen.getByTestId('dialog-backdrop'))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '新建文件' })).toBeNull())
    expect(trigger).toHaveFocus()
  })
})
