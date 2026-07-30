import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComposePaint } from '@compose-ui/core'
import { useState } from 'react'
import { ComposeColorHistoryProvider } from './compose-color-history'
import { ComposeColorPicker } from './compose-color-picker'
import { ComposePaintPicker } from './compose-paint-picker'
import type {
  ComposePaintImageLibrary,
  ComposePaintImageOption,
} from './compose-paint-picker'

const meta = {
  title: 'Components/ComposePaintPicker',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function ColorFixture() {
  const [value, setValue] = useState('#2f7df6')
  return <ComposeColorPicker label="背景" value={value} onValueChange={setValue} />
}

function PaintFixture() {
  const [value, setValue] = useState<ComposePaint>({
    kind: 'linear-gradient' as const,
    start: { x: 0, y: 0.5 },
    end: { x: 1, y: 0.5 },
    stops: [
      { id: 'violet', position: 0, color: '#8b5cf6' as const },
      { id: 'cyan', position: 0.56, color: '#22d3eecc' as const },
      { id: 'transparent', position: 1, color: 'transparent' as const },
    ],
  })
  return <ComposePaintPicker label="背景填充" value={value} onValueChange={setValue} />
}

const storyRecentImages: readonly ComposePaintImageOption[] = [
    { asset: { providerId: 'story', assetKey: 'nebula', scope: 'persistent' }, label: '星云', previewUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 160 100%22%3E%3Cdefs%3E%3CradialGradient id=%22g%22%3E%3Cstop stop-color=%22%23f472b6%22/%3E%3Cstop offset=%221%22 stop-color=%22%23312e81%22/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width=%22160%22 height=%22100%22 fill=%22url(%23g)%22/%3E%3C/svg%3E' },
    { asset: { providerId: 'story', assetKey: 'mountain', scope: 'persistent' }, label: '山峦', previewUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 160 100%22%3E%3Crect width=%22160%22 height=%22100%22 fill=%22%2393c5fd%22/%3E%3Cpath d=%22M0 100 55 35 88 70 118 42 160 100%22 fill=%22%231e3a5f%22/%3E%3C/svg%3E' },
    { asset: { providerId: 'story', assetKey: 'ocean', scope: 'persistent' }, label: '海浪', previewUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 160 100%22%3E%3Crect width=%22160%22 height=%22100%22 fill=%22%230e7490%22/%3E%3Cpath d=%22M0 62Q35 30 70 62t70 0 70 0v38H0%22 fill=%22%2367e8f9%22/%3E%3C/svg%3E' },
]

const storyPalette = ['312e81', '1d4ed8', '0891b2', '047857', 'ca8a04', 'ea580c', 'be123c']
const storyLibraryImages: readonly ComposePaintImageOption[] = [
  ...storyRecentImages,
  ...storyPalette.map((color, index) => ({
    asset: {
      providerId: 'story',
      assetKey: `texture-${index + 1}`,
      scope: 'persistent' as const,
    },
    label: `纹理 ${index + 1}`,
    previewUrl: `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 160 100%22%3E%3Crect width=%22160%22 height=%22100%22 fill=%22%23${color}%22/%3E%3Ccircle cx=%2280%22 cy=%2250%22 r=%2232%22 fill=%22%23ffffff%22 fill-opacity=%22.16%22/%3E%3C/svg%3E`,
  })),
]

const imageLibrary: ComposePaintImageLibrary = {
  recent: storyRecentImages,
  images: storyLibraryImages,
  status: 'ready',
  onUpload: async (file) => ({
    asset: {
      providerId: 'story',
      assetKey: `upload-${file.name}`,
      scope: 'session',
    },
    label: file.name,
    previewUrl: storyLibraryImages[0]!.previewUrl,
  }),
}

function ImageFixture() {
  const [value, setValue] = useState<ComposePaint>({ kind: 'image', asset: imageLibrary.recent![0]!.asset, fit: 'cover', opacity: 1, overlay: { color: '#8b5cf6', opacity: .4 } })
  return <ComposePaintPicker imageLibrary={imageLibrary} label="背景填充" value={value} onValueChange={setValue} />
}

export const Solid: Story = {
  render: () => (
    <ComposeColorHistoryProvider defaultColors={['#f97316', '#0ea5e9', '#22c55e']}>
      <ColorFixture />
    </ComposeColorHistoryProvider>
  ),
}

export const Gradient: Story = {
  render: () => (
    <ComposeColorHistoryProvider defaultColors={['#8b5cf6', '#22d3eecc']}>
      <PaintFixture />
    </ComposeColorHistoryProvider>
  ),
}

export const Image: Story = {
  render: () => <ImageFixture />,
}

export const Readonly: Story = {
  render: () => <ComposePaintPicker label="背景填充" readOnly value={{ kind: 'solid', color: '#33415580' }} />,
}
