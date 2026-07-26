import type { Preview } from '@storybook/react-vite'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import '@compose-ui/ui-context/styles.css'
import '@compose-ui/components/styles.css'
import '@compose-ui/command-panel/styles.css'
import '@compose-ui/history/styles.css'
import '@compose-ui/operation-log/styles.css'
import '@compose-ui/property-panel/styles.css'
import '@compose-ui/scene-tree/styles.css'
import '@compose-ui/stage/styles.css'
import '@compose-ui/asset-browser/styles.css'
import '@compose-ui/materials/styles.css'
import '@compose-ui/editor/styles.css'

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Compose UI theme',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
      },
    },
    locale: {
      description: 'Compose UI locale',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'zh-CN', title: '简体中文' },
          { value: 'en-US', title: 'English' },
        ],
      },
    },
  },
  initialGlobals: {
    theme: 'dark',
    locale: 'zh-CN',
  },
  decorators: [
    (Story, context) => (
      <ComposeUIProvider
        locale={context.globals.locale === 'en-US' ? 'en-US' : 'zh-CN'}
        theme={context.globals.theme === 'light' ? 'light' : 'dark'}
      >
        <div style={{ minHeight: 240, padding: 16 }}>
          <Story />
        </div>
      </ComposeUIProvider>
    ),
  ],
  parameters: {
    a11y: { test: 'error' },
    controls: { expanded: true },
  },
}

export default preview
