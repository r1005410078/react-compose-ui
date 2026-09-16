import { describe, expect, it } from 'vitest'
import {
  getComposeTextStyleState,
  planComposeApplyTextStyle,
  planComposeDetachTextStyle,
  resolveComposeStyles,
} from './text-style'
import { createTransactionRuntime } from './runtime'
import { validateComposeDocument } from './document'
import { documentFixture, rendererEntity } from './test-fixtures'
import type { ComposeDocument, ComposeEntity, JsonObject } from './document-types'

function textEntity(id: string, props: Record<string, unknown>, styleId?: string): ComposeEntity {
  return rendererEntity(id, {
    components: {
      Renderer: { type: 'text', props: props as JsonObject },
      ...(styleId === undefined ? {} : { Style: { text: styleId } }),
    },
  })
}

/** v7 的根层级只接受 Frame，因此共用仓库的 fixture 插一块根画板，命令用例才跑得起来。 */
function documentWith(
  entities: readonly ComposeEntity[],
  styles?: ComposeDocument['styles'],
): ComposeDocument {
  const base = documentFixture(
    Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    entities.map((entity) => entity.id),
  )
  return styles === undefined ? base : { ...base, styles }
}

const styles = {
  heading: { name: '卡片标题', props: { fontSize: 22, fontWeight: 600, color: '#d8e8ff' } },
}

describe('OpenSpec: compose-document / 样式值垫底，作者写下的值覆盖', () => {
  it('跟随者拿到样式的值', () => {
    const value = documentWith([textEntity('a', { text: '标题' }, 'heading')], styles)
    const resolved = resolveComposeStyles(value)
    expect(resolved.entities.a!.components.Renderer).toMatchObject({
      props: { text: '标题', fontSize: 22, fontWeight: 600, color: '#d8e8ff' },
    })
  })

  it('作者写下的字段覆盖样式，只影响这一处', () => {
    /*
     * 判别性的那一半：样式压过本地值的话就没有「这一条标题要大一号」这档能力了，而那是
     * 常见需求。文档里出现那个字段，就表示它被这一处覆盖了。
     */
    const value = documentWith([
      textEntity('a', { text: '标题', fontSize: 30 }, 'heading'),
      textEntity('b', { text: '另一条' }, 'heading'),
    ], styles)
    const resolved = resolveComposeStyles(value)
    expect(resolved.entities.a!.components.Renderer).toMatchObject({ props: { fontSize: 30 } })
    expect(resolved.entities.b!.components.Renderer).toMatchObject({ props: { fontSize: 22 } })
  })

  it('悬空引用保留作者写下的值，文档仍然合法', () => {
    // 「还没配」「配错了」「配的东西没了」三者必须可区分；做成非法会让删一条样式就阻断保存。
    const value = documentWith([textEntity('a', { text: '标题', fontSize: 12 }, 'gone')], styles)
    expect(resolveComposeStyles(value).entities.a!.components.Renderer)
      .toMatchObject({ props: { fontSize: 12 } })
    expect(getComposeTextStyleState(value, value.entities.a)).toBe('dangling')
    expect(getComposeTextStyleState(value, value.entities.a ? textEntity('b', {}) : undefined))
      .toBe('none')
    expect(getComposeTextStyleState(value, textEntity('c', {}, 'heading'))).toBe('bound')
  })

  it('纯函数：不改输入文档，且没有跟随者时原样交回', () => {
    const value = documentWith([textEntity('a', { text: '标题' }, 'heading')], styles)
    const before = JSON.stringify(value)
    resolveComposeStyles(value)
    expect(JSON.stringify(value)).toBe(before)

    /*
     * 没有任何 Entity 跟随时**原样交回输入引用**：下游普遍按引用判断「文档变没变」，
     * 凭空造一份新的会让每一帧都像是改过了。
     */
    const plain = documentWith([textEntity('a', { text: '标题' })], styles)
    expect(resolveComposeStyles(plain)).toBe(plain)
    const noStyles = documentWith([textEntity('a', { text: '标题' }, 'heading')])
    expect(resolveComposeStyles(noStyles)).toBe(noStyles)
  })

  it('改样式，跟随者一起变', () => {
    const entities = [textEntity('a', {}, 'heading'), textEntity('b', {}, 'heading')]
    const bigger = { heading: { ...styles.heading, props: { ...styles.heading.props, fontSize: 28 } } }
    const resolved = resolveComposeStyles(documentWith(entities, bigger))
    for (const id of ['a', 'b']) {
      expect(resolved.entities[id]!.components.Renderer, id).toMatchObject({ props: { fontSize: 28 } })
    }
  })
})

describe('OpenSpec: compose-document / 应用样式与脱离样式', () => {
  let index = 0
  const idFactory = () => `cmd-${index++}`

  function commandsOf(command: ReturnType<typeof planComposeApplyTextStyle>) {
    return (command?.payload.commands ?? []) as unknown as {
      type: string
      payload: Record<string, unknown>
    }[]
  }

  it('应用样式在同一个事务里删掉被管辖的 props', () => {
    /*
     * 判别性的那一半：解析是「样式垫底、作者值覆盖」，不删的话每个被管辖的字段都还是作者值，
     * 样式加上去**什么都不会变**——而屏幕上没有任何东西解释为什么。
     */
    const value = documentWith([
      textEntity('a', { text: '标题', fontSize: 12, fontWeight: 400, letterSpacing: 2 }),
    ], styles)
    const planned = planComposeApplyTextStyle({
      document: value, entityIds: ['a'], styleId: 'heading', idFactory,
    })
    const inner = commandsOf(planned)
    expect(planned!.type).toBe('transaction.batch')
    // 这个 Entity 还没有 Style Component，因此是 add 而不是 update——两条命令都不兜底，
    // 走错一支整个 batch 会被拒掉，症状是「点了没反应」。
    expect(inner.map((item) => item.type))
      .toEqual(['entity.renderer.props.set', 'entity.component.add'])
    // 样式管 fontSize/fontWeight/color，不管 text 与 letterSpacing。
    expect(inner[0]!.payload.props).toEqual({ text: '标题', letterSpacing: 2 })
    expect(inner[1]!.payload).toMatchObject({ key: 'Style', value: { text: 'heading' } })

    // 已经跟随着另一条样式时改走 update——`entity.component.add` 在已存在时同样被拒。
    const following = documentWith([textEntity('a', { text: '标题' }, 'heading')], styles)
    expect(commandsOf(planComposeApplyTextStyle({
      document: following, entityIds: ['a'], styleId: 'heading', idFactory,
    })).map((item) => item.type))
      .toEqual(['entity.renderer.props.set', 'entity.component.update'])
  })

  it('脱离样式把解析值写成作者值，呈现不变', () => {
    const value = documentWith([textEntity('a', { text: '标题' }, 'heading')], styles)
    const before = resolveComposeStyles(value).entities.a!.components.Renderer
    const planned = planComposeDetachTextStyle({
      document: value, entityIds: ['a'], idFactory,
    })
    const inner = commandsOf(planned)
    expect(inner.map((item) => item.type))
      .toEqual(['entity.renderer.props.set', 'entity.component.remove'])
    expect(inner[0]!.payload.props).toEqual((before as { props: unknown }).props)
  })

  it('没有可作用的目标时不产出命令', () => {
    // 一条什么都不做的事务仍然会进撤销历史，用户按一下撤销会以为自己撤掉了别的东西。
    const value = documentWith([textEntity('a', { text: '标题' })], styles)
    expect(planComposeDetachTextStyle({ document: value, entityIds: ['a'], idFactory }))
      .toBeNull()
    expect(planComposeApplyTextStyle({
      document: value, entityIds: ['a'], styleId: 'gone', idFactory,
    })).toBeNull()
  })
})

describe('OpenSpec: compose-document / 文字样式表命令', () => {
  let commandId = 0

  function run(value: ComposeDocument, type: string, payload: Record<string, unknown>) {
    const runtime = createTransactionRuntime({ document: value })
    const result = runtime.dispatch({
      id: `command-${commandId++}`,
      type,
      payload: payload as never,
      meta: { label: type, source: 'test' },
    })
    return { status: result.status, document: runtime.document, result }
  }

  it('upsert：同一条命令既新建也改写', () => {
    /*
     * 新建与更新的载荷与补丁逐字相同，差别只是「这个 id 在不在」——而那不是一个用户能说出来
     * 的区别，分成两条只会让调用方先查一次再选命令。
     */
    const empty = documentWith([])
    const created = run(empty, 'document.style.text.set', {
      styleId: 'heading', name: '卡片标题', props: { fontSize: 22 },
    })
    expect(created.status).toBe('committed')
    if (created.status !== 'committed') return
    expect(created.document.styles).toEqual({ heading: { name: '卡片标题', props: { fontSize: 22 } } })

    const updated = run(created.document, 'document.style.text.set', {
      styleId: 'heading', name: '卡片标题', props: { fontSize: 28 },
    })
    expect(updated.status).toBe('committed')
    if (updated.status !== 'committed') return
    expect(updated.document.styles!.heading!.props).toEqual({ fontSize: 28 })
  })

  it('值没变不产生事务', () => {
    // 一条什么都不做的事务仍然会进撤销历史，用户按一下撤销会以为自己撤掉了别的东西。
    const value = documentWith([], styles)
    expect(run(value, 'document.style.text.set', {
      styleId: 'heading', name: styles.heading.name, props: styles.heading.props,
    }).status).toBe('noop')
  })

  it('删掉样式不追着去解除引用，跟随者保留作者写下的值', () => {
    /*
     * 追着解除等于把一次删除变成一次波及全文档的写入，而撤销还得把它们一条条放回去。
     * 悬空只是解析失败——跟随者照常渲染。
     */
    const value = documentWith([textEntity('a', { text: '标题', fontSize: 12 }, 'heading')], styles)
    const removed = run(value, 'document.style.text.remove', { styleId: 'heading' })
    expect(removed.status).toBe('committed')
    if (removed.status !== 'committed') return
    expect(removed.document.styles).toEqual({})
    expect(removed.document.entities.a!.components.Style).toEqual({ text: 'heading' })
    expect(getComposeTextStyleState(removed.document, removed.document.entities.a)).toBe('dangling')
    expect(resolveComposeStyles(removed.document).entities.a!.components.Renderer)
      .toMatchObject({ props: { fontSize: 12 } })
  })

  it('非法载荷被拒而不是写进一条坏样式', () => {
    const empty = documentWith([])
    for (const payload of [
      { styleId: '', name: 'x', props: {} },
      { styleId: 'a', name: '', props: {} },
      { styleId: 'a', name: 'x', props: 'not-an-object' },
    ]) {
      expect(run(empty, 'document.style.text.set', payload).status, JSON.stringify(payload))
        .toBe('rejected')
    }
  })
})

describe('OpenSpec: compose-document / 可选文字样式表 / 校验', () => {
  it('结构不合法的样式表被拒，而悬空引用不算非法', () => {
    /*
     * 判别性的那一半：把悬空做成非法会让**删掉一条样式就阻断保存**，而「还没配」「配错了」
     * 「配的东西没了」必须可区分——与导线绑定的悬空引用是同一条判断。
     */
    const dangling = documentWith([textEntity('a', { text: '标题' }, 'gone')], {})
    expect(validateComposeDocument(dangling).valid).toBe(true)

    for (const styles of [
      'not-an-object' as unknown as ComposeDocument['styles'],
      { heading: 'not-an-object' } as unknown as ComposeDocument['styles'],
      { heading: { name: '', props: {} } },
      { heading: { name: '标题', props: 'x' } } as unknown as ComposeDocument['styles'],
    ]) {
      expect(validateComposeDocument(documentWith([], styles)).valid, JSON.stringify(styles))
        .toBe(false)
    }
  })

  it('没有 styles 的文档照常合法', () => {
    // 缺席即没有样式：既有文档逐字节不变，因此这个字段不需要迁移、协议版本不变。
    expect(validateComposeDocument(documentWith([textEntity('a', {})])).valid).toBe(true)
  })
})

describe('OpenSpec: compose-document / 建样式再应用，整条走事务运行时', () => {
  it('两条命令依次提交后，这个 Entity 真的跟上了', () => {
    /*
     * 规划器交出的 batch 只要有一支被拒，**整条事务都会被拒**，而屏幕上看到的是「点了
     * 没反应」。这条用例把两次 dispatch 串起来跑，挡的正是那一档。
     */
    const runtime = createTransactionRuntime({
      document: documentWith([textEntity('a', { text: '标题', fontSize: 12 })]),
    })
    let id = 0
    const next = () => `cmd-${id++}`
    const created = runtime.dispatch({
      id: next(),
      type: 'document.style.text.set',
      payload: { styleId: 'heading', name: '卡片标题', props: { fontSize: 22 } } as never,
    })
    expect(created.status, JSON.stringify(created)).toBe('committed')

    const apply = planComposeApplyTextStyle({
      document: runtime.document, entityIds: ['a'], styleId: 'heading', idFactory: next,
    })
    expect(apply).not.toBeNull()
    const applied = runtime.dispatch(apply!)
    expect(applied.status, JSON.stringify(applied)).toBe('committed')
    expect(runtime.document.entities.a!.components.Style).toEqual({ text: 'heading' })
    expect(resolveComposeStyles(runtime.document).entities.a!.components.Renderer)
      .toMatchObject({ props: { text: '标题', fontSize: 22 } })
  })
})
