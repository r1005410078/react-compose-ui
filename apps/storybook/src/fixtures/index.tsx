import { createComposeComponentRegistry } from '@compose-ui/component-registry'
import type { ComposeComponentRendererProps } from '@compose-ui/component-registry'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeDocument,
} from '@compose-ui/core'

/** Storybook 共享的、无外部副作用的 Component renderer。 */
export function StoryCardRenderer({ props }: ComposeComponentRendererProps) {
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
export const storyRegistry = createComposeComponentRegistry([
  {
    type: 'story.card',
    label: 'Story card',
    defaultName: 'Story card',
    defaultSize: { width: 240, height: 120 },
    createDefaultProps: () => ({ label: 'Compose card' }),
    renderer: StoryCardRenderer,
  },
])

/** 返回新的文档对象，避免每个 Story 或 play function 相互污染。 */
export function createStoryDocument(): ComposeDocument {
  return {
    schemaVersion: 3,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: ['story-frame'],
    nodes: {
      'story-frame': {
        id: 'story-frame',
        kind: 'frame',
        name: 'Story frame',
        visible: true,
        locked: false,
        transform: { x: 80, y: 72, width: 560, height: 360, rotation: 0 },
        style: { backgroundColor: '#ffffff', borderColor: '#94a3b8', borderWidth: 1 },
        childIds: ['story-card'],
        clipContent: true,
      },
      'story-card': {
        id: 'story-card',
        kind: 'component',
        name: 'Story card',
        visible: true,
        locked: false,
        transform: { x: 48, y: 48, width: 240, height: 120, rotation: 0 },
        componentType: 'story.card',
        props: { label: 'Compose card' },
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
