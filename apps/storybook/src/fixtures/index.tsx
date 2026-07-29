/* eslint-disable react-refresh/only-export-components -- Storybook workspace 需要从单一夹具入口共享 Renderer、Registry 和 factory。 */
import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposeRendererProps } from '@compose-ui/component-registry'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeDocument,
} from '@compose-ui/core'

/** Storybook 共享的、无外部副作用的 Component renderer。 */
export function StoryCardRenderer({ props }: ComposeRendererProps) {
  const label = typeof props.label === 'string' ? props.label : 'Compose card'
  return (
    <div
      style={{
        alignItems: 'center',
        background: '#2563eb',
        color: 'white',
        display: 'flex',
        fontFamily: 'system-ui, sans-serif',
        height: '100%',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      {label}
    </div>
  )
}

/** Storybook 所有编辑/预览故事共用的稳定 registry。 */
export const storyRegistry = createComposeEntityRegistry({
  renderers: [{
    type: 'story.card',
    label: 'Story card',
    renderer: StoryCardRenderer,
  }],
  components: [
    {
      key: 'Composition',
      label: 'Composition',
      hidden: true,
      createDefault: () => ({ presetId: null, baseComponentKeys: [], capabilityIds: [] }),
    },
    {
      key: 'Transform',
      label: 'Transform',
      order: 10,
      createDefault: () => ({
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        rotation: 0,
      }),
    },
    {
      key: 'Visibility',
      label: 'Visibility',
      order: 20,
      createDefault: () => ({ visible: true }),
    },
    {
      key: 'Lock',
      label: 'Lock',
      order: 30,
      createDefault: () => ({ locked: false }),
    },
    {
      key: 'Appearance',
      label: 'Appearance',
      order: 40,
      createDefault: () => ({ backgroundPaint: { kind: 'solid', color: 'transparent' } }),
    },
    {
      key: 'Hierarchy',
      label: 'Container',
      order: 50,
      createDefault: () => ({ childIds: [] }),
    },
    {
      key: 'Clip',
      label: 'Clip',
      order: 60,
      createDefault: () => ({ enabled: true }),
    },
    {
      key: 'Renderer',
      label: 'Content',
      hidden: true,
      order: 80,
      createDefault: () => ({ type: 'unknown', props: {} }),
    },
  ],
  presets: [
    {
      id: 'story.container',
      label: 'Story container',
      createComponents: () => ({
        Transform: {
          position: { x: 0, y: 0 },
          size: { width: 560, height: 360 },
          rotation: 0,
        },
        Visibility: { visible: true },
        Lock: { locked: false },
        Hierarchy: { childIds: [] },
        Clip: { enabled: true },
        Appearance: { backgroundPaint: { kind: 'solid', color: '#ffffff' } },
      }),
    },
    {
      id: 'story.card',
      label: 'Story card',
      createComponents: () => ({
        Transform: {
          position: { x: 0, y: 0 },
          size: { width: 240, height: 120 },
          rotation: 0,
        },
        Visibility: { visible: true },
        Lock: { locked: false },
        Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' } },
        Renderer: { type: 'story.card', props: { label: 'Compose card' } },
      }),
    },
  ],
})

/** 返回新的文档对象，避免每个 Story 或 play function 相互污染。 */
export function createStoryDocument(): ComposeDocument {
  return {
    schemaVersion: 5,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: ['story-container'],
    entities: {
      'story-container': {
        id: 'story-container',
        name: 'Story container',
        components: {
          Composition: {
            presetId: 'story.container',
            baseComponentKeys: [
              'Transform',
              'Visibility',
              'Lock',
              'Hierarchy',
              'Clip',
              'Appearance',
            ],
            capabilityIds: [],
          },
          Transform: {
            position: { x: 80, y: 72 },
            size: { width: 560, height: 360 },
            rotation: 0,
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Appearance: {
            backgroundPaint: { kind: 'solid', color: '#ffffff' },
            borderColor: '#94a3b8',
            borderWidth: 1,
          },
          Hierarchy: { childIds: ['story-card'] },
          Clip: { enabled: true },
        },
      },
      'story-card': {
        id: 'story-card',
        name: 'Story card',
        components: {
          Composition: {
            presetId: 'story.card',
            baseComponentKeys: [
              'Transform',
              'Visibility',
              'Lock',
              'Appearance',
              'Renderer',
            ],
            capabilityIds: [],
          },
          Transform: {
            position: { x: 48, y: 48 },
            size: { width: 240, height: 120 },
            rotation: 0,
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' } },
          Renderer: { type: 'story.card', props: { label: 'Compose card' } },
        },
      },
    },
  }
}

/** 返回只读的内存 Provider；Storybook 不会访问真实磁盘或网络。 */
export function createStoryAssetProvider(): ComposeAssetProvider {
  const root = { id: 'assets', parentId: null, name: 'Assets', kind: 'folder' as const }
  const logo = {
    id: 'compose-logo',
    parentId: 'assets',
    name: 'compose-logo.svg',
    kind: 'file' as const,
    mediaType: 'image/svg+xml',
    revision: '1',
    size: 180,
  }
  const readme = {
    id: 'readme',
    parentId: 'assets',
    name: 'readme.md',
    kind: 'file' as const,
    mediaType: 'text/markdown',
    revision: '1',
    size: 64,
  }
  return {
    id: 'storybook-assets',
    label: 'Storybook assets',
    root,
    capabilities: {
      createFile: false,
      createFolder: false,
      delete: false,
      move: false,
      rename: false,
      write: false,
    },
    list: async ({ folderId }) => folderId === root.id ? [logo, readme] : [],
    read: async ({ fileId }) => ({
      blob: fileId === logo.id
        ? new Blob([
          '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="96"><rect width="160" height="96" fill="#2563eb"/><text x="18" y="58" fill="white">Compose</text></svg>',
        ], { type: 'image/svg+xml' })
        : new Blob(['# Compose assets\nStorybook fixture'], { type: 'text/markdown' }),
      revision: '1',
    }),
  }
}
