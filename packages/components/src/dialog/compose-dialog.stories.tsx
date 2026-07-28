import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ComposeButton } from '../button'
import { ComposeInput } from '../input'
import {
  ComposeDialog,
  ComposeDialogBackdrop,
  ComposeDialogClose,
  ComposeDialogContent,
  ComposeDialogDescription,
  ComposeDialogFooter,
  ComposeDialogHeader,
  ComposeDialogPortal,
  ComposeDialogTitle,
  ComposeDialogTrigger,
  ComposeDialogViewport,
} from './index'

const meta = {
  title: 'Components/ComposeDialog',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function DialogFixture({ longContent = false }: { readonly longContent?: boolean }) {
  return (
    <ComposeDialog>
      <ComposeDialogTrigger className="cu:rounded-sm cu:border cu:border-border cu:bg-secondary cu:px-3 cu:py-2 cu:text-secondary-foreground">
        打开新建文件弹框
      </ComposeDialogTrigger>
      <ComposeDialogPortal>
        <ComposeDialogBackdrop />
        <ComposeDialogViewport>
          <ComposeDialogContent>
            <ComposeDialogHeader>
              <ComposeDialogTitle>新建文件</ComposeDialogTitle>
            </ComposeDialogHeader>
            <ComposeDialogDescription>请输入将要创建的资源名称。</ComposeDialogDescription>
            {longContent ? Array.from({ length: 20 }, (_, index) => (
              <p key={index}>这是可滚动的弹框内容第 {index + 1} 行。</p>
            )) : (
              <label className="cu:mt-5 cu:grid cu:gap-2">
                <span>名称</span>
                <ComposeInput defaultValue="untitled.ts" />
              </label>
            )}
            <ComposeDialogFooter>
              <ComposeDialogClose>取消</ComposeDialogClose>
              <ComposeButton type="button">创建</ComposeButton>
            </ComposeDialogFooter>
          </ComposeDialogContent>
        </ComposeDialogViewport>
      </ComposeDialogPortal>
    </ComposeDialog>
  )
}

export const Default: Story = { render: () => <DialogFixture /> }
export const LongContent: Story = { render: () => <DialogFixture longContent /> }

function ControlledFixture() {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>重新打开</button>
      <ComposeDialog open={open} onOpenChange={setOpen}>
        <ComposeDialogPortal>
          <ComposeDialogBackdrop />
          <ComposeDialogViewport>
            <ComposeDialogContent>
              <ComposeDialogTitle>受控弹框</ComposeDialogTitle>
              <ComposeDialogDescription>Escape、遮罩点击和关闭按钮都会通知宿主。</ComposeDialogDescription>
              <ComposeDialogFooter><ComposeDialogClose>关闭</ComposeDialogClose></ComposeDialogFooter>
            </ComposeDialogContent>
          </ComposeDialogViewport>
        </ComposeDialogPortal>
      </ComposeDialog>
    </>
  )
}

export const Controlled: Story = { render: () => <ControlledFixture /> }
