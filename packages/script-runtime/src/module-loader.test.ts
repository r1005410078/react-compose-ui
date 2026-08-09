import type { ComposeAssetResolver } from '@compose-ui/assets'
import type { ComposePageSetupReference } from '@compose-ui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  ComposeScriptLoadError,
  createComposeJavaScriptModuleLoader,
  loadComposePageScriptScope,
} from './module-loader'

const reference: ComposePageSetupReference = {
  providerId: 'project',
  assetKey: 'Home.setup.js',
  scope: 'persistent',
}

describe('OpenSpec: page-script-runtime / 受信任 JavaScript Loader 边界', () => {
  it('读取稳定资源、导入模块并始终回收临时 URL', async () => {
    const resolver: ComposeAssetResolver = {
      resolve: vi.fn(async () => ({
        blob: new Blob(['export function setup() { return { value: 1 } }'], {
          type: 'text/javascript',
        }),
        revision: '7',
        mediaType: 'text/javascript',
      })),
    }
    const revokeObjectURL = vi.fn()
    const loader = createComposeJavaScriptModuleLoader({
      assetResolver: resolver,
      createObjectURL: () => 'blob:test-module',
      revokeObjectURL,
      importModule: vi.fn(async () => ({ setup: () => ({ value: 1 }) })),
    })

    const loaded = await loader.load(reference)
    expect(loaded.revision).toBe('7')
    expect(loaded.module.setup).toBeTypeOf('function')
    expect(resolver.resolve).toHaveBeenCalledWith({ reference, signal: undefined })
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-module')
  })

  it('明确拒绝 TypeScript 且不尝试导入', async () => {
    const importModule = vi.fn()
    const loader = createComposeJavaScriptModuleLoader({
      assetResolver: {
        resolve: async () => ({
          blob: new Blob(['export function setup(ctx: unknown) {}']),
          revision: '1',
          mediaType: 'text/typescript',
        }),
      },
      importModule,
    })
    await expect(loader.load({ ...reference, assetKey: 'Home.setup.ts' }))
      .rejects.toMatchObject({ code: 'script.unsupported-module' })
    expect(importModule).not.toHaveBeenCalled()
  })

  it('加载失败归一化为 scope diagnostic', async () => {
    const result = await loadComposePageScriptScope({
      reference,
      loader: {
        load: async () => {
          throw new ComposeScriptLoadError('script.module-load-failed', 'CSP blocked')
        },
      },
    })
    expect(result.scope.getSnapshot().diagnostics).toContainEqual(expect.objectContaining({
      code: 'script.module-load-failed',
    }))
  })
})
