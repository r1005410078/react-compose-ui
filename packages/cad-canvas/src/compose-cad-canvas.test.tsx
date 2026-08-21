import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  createCadCommandHandlers,
  createEmptyCadDocument,
  getCadLine,
  validateCadDocument,
  type CadDocument,
} from '@compose-ui/cad'
import { createDocumentTransactionRuntime } from '@compose-ui/core'
import type { DocumentValidationIssueShape, EditorCommand } from '@compose-ui/core'
import { ComposeCadCanvas } from './compose-cad-canvas'

/** 让画布拿到确定的 surface 矩形：jsdom 下 getBoundingClientRect 恒为 0。 */
function stubSurfaceRect() {
  Object.defineProperty(SVGElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0 }),
  })
}

function setup() {
  stubSurfaceRect()
  let counter = 0
  const runtime = createDocumentTransactionRuntime<CadDocument, DocumentValidationIssueShape>({
    document: createEmptyCadDocument(),
    validate: validateCadDocument,
    handlers: createCadCommandHandlers(),
  })
  const dispatch = (command: EditorCommand) => { runtime.dispatch(command) }
  const view = render(
    <ComposeCadCanvas
      document={runtime.document}
      idFactory={() => `id-${++counter}`}
      onDispatch={dispatch}
    />,
  )
  const rerender = () => {
    view.rerender(
      <ComposeCadCanvas
        document={runtime.document}
        idFactory={() => `id-${++counter}`}
        onDispatch={dispatch}
      />,
    )
  }
  return { runtime, rerender }
}

function clickAt(x: number, y: number) {
  const surface = screen.getByTestId('cad-surface')
  fireEvent.pointerDown(surface, { button: 0, clientX: x, clientY: y, pointerId: 1 })
}

/** 在命令行键入一行并回车；空字符串等于直接确认。 */
function submit(text: string) {
  const input = screen.getByTestId('cad-command-input')
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

function cancel() {
  fireEvent.keyDown(screen.getByTestId('cad-command-input'), { key: 'Escape' })
}

function lines(document: CadDocument) {
  return document.rootIds.map((id) => getCadLine(document.entities[id]!)!)
}

// 仓库的共享 setup 只装了 jest-dom 匹配器，没有开自动 cleanup；同一文件内多次 render 会让
// testId 查询命中上一次的 DOM。
afterEach(cleanup)

describe('CAD 画布与命令行', () => {
  it('OpenSpec: cad-document / CAD 直线命令 / 两点画出一条直线', () => {
    const { runtime, rerender } = setup()

    submit('L')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('指定第一点')

    clickAt(10, 20)
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('指定下一点')
    clickAt(110, 20)
    // 命令进行中即有预览。
    expect(document.querySelectorAll('[data-cad-preview]')).toHaveLength(1)

    submit('')
    expect(lines(runtime.document)).toEqual([{ start: { x: 10, y: 20 }, end: { x: 110, y: 20 } }])

    rerender()
    expect(document.querySelectorAll('[data-cad-entity]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-cad-preview]')).toHaveLength(0)

    // 一次撤销回到命令开始之前。
    runtime.undo()
    expect(runtime.document.rootIds).toEqual([])
  })

  it('空闲时点击图面不做任何事', () => {
    const { runtime } = setup()
    clickAt(10, 20)
    clickAt(110, 20)
    expect(runtime.document.rootIds).toEqual([])
    expect(runtime.canUndo).toBe(false)
  })

  it('未知命令给出提示且不开始会话', () => {
    setup()
    submit('NOPE')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('未知命令')
    clickAt(10, 20)
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('未知命令')
  })

  it('OpenSpec: cad-document / CAD 直线命令 / 取消不写入文档', () => {
    const { runtime } = setup()
    submit('LINE')
    clickAt(10, 20)
    clickAt(110, 20)

    cancel()
    expect(runtime.document.rootIds).toEqual([])
    expect(document.querySelectorAll('[data-cad-preview]')).toHaveLength(0)
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('已取消')
  })

  it('命令行显示关键字，且拒绝不结束会话', () => {
    const { runtime } = setup()
    submit('L')
    clickAt(0, 0)
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('放弃(U)')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('结束(F)')

    submit('ZZZ')
    expect(screen.getByTestId('cad-command-prompt')).toHaveTextContent('需要一个点')

    // 会话仍然活着：继续取点即可完成。
    clickAt(50, 50)
    submit('F')
    expect(lines(runtime.document)).toEqual([{ start: { x: 0, y: 0 }, end: { x: 50, y: 50 } }])
  })

  it('滚轮缩放围绕光标，图元跟着改变屏幕位置', () => {
    const { runtime, rerender } = setup()
    submit('L')
    clickAt(100, 100)
    clickAt(200, 100)
    submit('')
    rerender()

    const surface = screen.getByTestId('cad-surface')
    const before = document.querySelector('[data-cad-entity]')!.getAttribute('x2')
    fireEvent.wheel(surface, { deltaY: -100, clientX: 0, clientY: 0 })
    expect(document.querySelector('[data-cad-entity]')!.getAttribute('x2')).not.toBe(before)
    expect(runtime.document.rootIds).toHaveLength(1)
  })

  it('隐藏图层上的图元不渲染', () => {
    stubSurfaceRect()
    const base = createEmptyCadDocument()
    const hidden: CadDocument = {
      ...base,
      layers: [{ ...base.layers[0]!, visible: false }],
      rootIds: ['l1'],
      entities: {
        l1: {
          id: 'l1',
          name: 'Line',
          components: {
            CadPlacement: { layerId: '0' },
            CadLine: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
          },
        },
      },
    }
    render(<ComposeCadCanvas document={hidden} onDispatch={vi.fn()} />)
    expect(document.querySelectorAll('[data-cad-entity]')).toHaveLength(0)
  })
})
