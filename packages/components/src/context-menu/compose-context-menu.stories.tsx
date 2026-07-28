import type { Meta, StoryObj } from '@storybook/react-vite'
import { ComposeThemeProvider } from '@compose-ui/ui-context'
import {
  ComposeContextMenu,
  ComposeContextMenuCheckboxItem,
  ComposeContextMenuContent,
  ComposeContextMenuItem,
  ComposeContextMenuRadioGroup,
  ComposeContextMenuRadioItem,
  ComposeContextMenuSeparator,
  ComposeContextMenuShortcut,
  ComposeContextMenuSub,
  ComposeContextMenuSubContent,
  ComposeContextMenuSubTrigger,
  ComposeContextMenuTrigger,
  useComposeContextMenu,
} from './index'

const meta = {
  title: 'Components/ComposeContextMenu',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function ContextMenuFixture() {
  return (
    <ComposeContextMenu>
      <ComposeContextMenuTrigger className="cu:inline-flex cu:rounded-md cu:border cu:border-border cu:px-3 cu:py-2">
        在此处右键
      </ComposeContextMenuTrigger>
      <ComposeContextMenuContent aria-label="节点操作">
        <ComposeContextMenuItem>复制<ComposeContextMenuShortcut>⌘C</ComposeContextMenuShortcut></ComposeContextMenuItem>
        <ComposeContextMenuItem>粘贴<ComposeContextMenuShortcut>⌘V</ComposeContextMenuShortcut></ComposeContextMenuItem>
        <ComposeContextMenuSeparator />
        <ComposeContextMenuItem variant="destructive">删除</ComposeContextMenuItem>
      </ComposeContextMenuContent>
    </ComposeContextMenu>
  )
}

export const Default: Story = { render: () => <ContextMenuFixture /> }

export const DisabledAndDestructive: Story = {
  render: () => (
    <ComposeContextMenu>
      <ComposeContextMenuTrigger className="cu:inline-flex cu:rounded-md cu:border cu:border-border cu:px-3 cu:py-2">
        受限资源
      </ComposeContextMenuTrigger>
      <ComposeContextMenuContent aria-label="受限资源操作">
        <ComposeContextMenuItem disabled>重命名</ComposeContextMenuItem>
        <ComposeContextMenuItem disabled variant="destructive">删除</ComposeContextMenuItem>
      </ComposeContextMenuContent>
    </ComposeContextMenu>
  ),
}

export const CheckboxRadioAndSubmenu: Story = {
  render: () => (
    <ComposeContextMenu>
      <ComposeContextMenuTrigger className="cu:inline-flex cu:rounded-md cu:border cu:border-border cu:px-3 cu:py-2">
        显示选项
      </ComposeContextMenuTrigger>
      <ComposeContextMenuContent aria-label="显示选项">
        <ComposeContextMenuCheckboxItem checked>显示网格</ComposeContextMenuCheckboxItem>
        <ComposeContextMenuSeparator />
        <ComposeContextMenuRadioGroup value="fit">
          <ComposeContextMenuRadioItem value="fit">适应画布</ComposeContextMenuRadioItem>
          <ComposeContextMenuRadioItem value="actual">实际大小</ComposeContextMenuRadioItem>
        </ComposeContextMenuRadioGroup>
        <ComposeContextMenuSeparator />
        <ComposeContextMenuSub>
          <ComposeContextMenuSubTrigger>主题</ComposeContextMenuSubTrigger>
          <ComposeContextMenuSubContent aria-label="主题选项">
            <ComposeContextMenuItem>深色</ComposeContextMenuItem>
            <ComposeContextMenuItem>浅色</ComposeContextMenuItem>
          </ComposeContextMenuSubContent>
        </ComposeContextMenuSub>
      </ComposeContextMenuContent>
    </ComposeContextMenu>
  ),
}

function HookFixture() {
  const menu = useComposeContextMenu<string>()
  return (
    <>
      <button
        type="button"
        onContextMenu={(event) => menu.openAt(event, 'asset-01')}
      >
        资源 asset-01
      </button>
      <ComposeContextMenu {...menu.rootProps}>
        <ComposeContextMenuContent aria-label="资源操作">
          <ComposeContextMenuItem>重命名 {menu.payload}</ComposeContextMenuItem>
        </ComposeContextMenuContent>
      </ComposeContextMenu>
    </>
  )
}

export const HookDriven: Story = { render: () => <HookFixture /> }

export const LightTokenOverride: Story = {
  decorators: [
    (Story) => (
      <ComposeThemeProvider overrides={{ light: { accent: '#7c3aed' } }} theme="light">
        <Story />
      </ComposeThemeProvider>
    ),
  ],
  render: () => <ContextMenuFixture />,
}
