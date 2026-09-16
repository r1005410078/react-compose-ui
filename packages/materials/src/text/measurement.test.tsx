// @vitest-environment jsdom
import { render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMPOSE_TEXT_LAYOUT_LOCALE } from './defaults'
import { TEXT_RENDERER_MEASUREMENT } from './measurement'
import { TextRenderer } from './renderer'

/**
 * 一份可控的 `document.fonts`：jsdom 没有 CSS Font Loading API，而这里要断的正是订阅那一刻
 * 字体在不在加载中。
 */
function installFonts(status: 'loading' | 'loaded') {
  const listeners = new Map<string, Set<() => void>>()
  let resolveReady: () => void = () => undefined
  const ready = new Promise<void>((resolve) => { resolveReady = resolve })
  const fonts = {
    status,
    ready,
    addEventListener: (type: string, listener: () => void) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(listener))
    },
    removeEventListener: (type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener)
    },
  }
  // 已就绪的字体集，它的 `ready` 是一个早已兑现的 Promise——修掉的正是对这次兑现的响应。
  if (status === 'loaded') resolveReady()
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts })
  return {
    finish: () => {
      fonts.status = 'loaded'
      resolveReady()
      listeners.get('loadingdone')?.forEach((listener) => { listener() })
    },
  }
}

afterEach(() => {
  Reflect.deleteProperty(document, 'fonts')
})

describe('text measurement / 字体订阅', () => {
  it('字体早已就绪时订阅不产生任何失效', async () => {
    installFonts('loaded')
    const invalidate = vi.fn()
    const unsubscribe = TEXT_RENDERER_MEASUREMENT.subscribe!({ invalidate } as never)
    // `fonts.ready` 早已兑现：它的回调若还挂着，会在这几个微任务里跑出来。
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    /*
     * 判别性的那一半：一份真实图纸上一千九百个文字各订阅一次，字体早就就绪，每一次「没有
     * 内容的失效」都换来一整趟布局重解——打开图纸时整页冻住十秒就是它。
     */
    expect(invalidate).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('字体仍在加载时，加载完成后失效一次', async () => {
    const fonts = installFonts('loading')
    const invalidate = vi.fn()
    const unsubscribe = TEXT_RENDERER_MEASUREMENT.subscribe!({ invalidate } as never)
    expect(invalidate).not.toHaveBeenCalled()
    fonts.finish()
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(invalidate).toHaveBeenCalled()
    unsubscribe()
  })
})

describe('text measurement / 排版 locale', () => {
  it('测量宿主与渲染节点钉同一个 locale', () => {
    const hosts: HTMLElement[] = []
    const append = vi.spyOn(document.body, 'append').mockImplementation(function (
      this: HTMLElement,
      ...nodes: (Node | string)[]
    ) {
      for (const node of nodes) if (node instanceof HTMLElement) hosts.push(node)
      return Element.prototype.append.apply(this, nodes as never)
    } as typeof document.body.append)
    try {
      TEXT_RENDERER_MEASUREMENT.measure({
        props: { text: '储能系统运行监控大屏', fontSize: 28 },
        width: { mode: 'undefined' },
        height: { mode: 'undefined' },
      } as never)
    }
    finally {
      append.mockRestore()
    }
    /*
     * 判别性的那一半：中日韩字形回退按 locale 选字体，而不按 `font-family`。宿主挂在
     * `document.body` 上继承宿主页面的 `<html lang>`、渲染节点继承 Stage 根上的编辑器
     * 语言，两边不相等时量出来的是另一套字体的字宽——中文 Hug 文字因此折行并被裁成
     * 最后一个字。两处读同一个常量是这件事唯一的保证。
     */
    expect(hosts).toHaveLength(1)
    expect(hosts[0]!.lang).toBe(COMPOSE_TEXT_LAYOUT_LOCALE)

    const props = { props: { text: '储能系统运行监控大屏' } } as unknown as
      ComponentProps<typeof TextRenderer>
    const rendered = render(<TextRenderer {...props} />)
    expect(rendered.getByTestId('compose-material-text').lang).toBe(COMPOSE_TEXT_LAYOUT_LOCALE)
    rendered.unmount()
  })
})
