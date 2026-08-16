import { describe, expect, it } from 'vitest'
import {
  composeAnimationDisplayName,
  composeAnimationFileName,
  createComposeAnimationFile,
  isComposeAnimationFileName,
  parseComposeAnimationFile,
  serializeComposeAnimationFile,
} from './animation-file'

describe('动画文件格式', () => {
  it('序列化与解析往返后清单逐字段相等且没有 issue', () => {
    const file = createComposeAnimationFile({
      id: 'anim-1',
      name: '入场',
      durationMs: 1200,
      playbackMode: 'loop',
      bindings: {
        playing: { scope: 'page', exportName: 'animate' },
      },
    })
    const result = parseComposeAnimationFile(serializeComposeAnimationFile(file))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.file).toEqual(file)
  })

  it('构造器缺省时长与播放模式对齐编辑器默认值', () => {
    const file = createComposeAnimationFile({ id: 'anim-1', name: '动画 1' })
    expect(file.animation.durationMs).toBe(300)
    expect(file.animation.playbackMode).toBe('play-once')
  })

  it('拒绝非法 JSON 并返回结构化 issue', () => {
    const result = parseComposeAnimationFile('{not json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]?.code).toBe('animation-file.invalid-json')
  })

  it('拒绝未知版本', () => {
    const file = createComposeAnimationFile({ id: 'anim-1', name: '动画 1' })
    const text = serializeComposeAnimationFile(file)
      .replace('"animationSchemaVersion": 1', '"animationSchemaVersion": 2')
    const result = parseComposeAnimationFile(text)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'animation-file.unsupported-version'))
        .toBe(true)
    }
  })

  it('拒绝未知字段、错误 kind 与缺失清单', () => {
    const result = parseComposeAnimationFile(JSON.stringify({
      kind: 'compose-page',
      animationSchemaVersion: 1,
      extra: true,
    }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const codes = result.issues.map((issue) => issue.code)
      expect(codes).toContain('animation-file.invalid-shape')
      expect(result.issues.some((issue) => issue.path[0] === 'animation')).toBe(true)
    }
  })

  it('清单字段非法时按文件内路径报告 issue', () => {
    const result = parseComposeAnimationFile(JSON.stringify({
      kind: 'compose-animation',
      animationSchemaVersion: 1,
      animation: { id: 'anim-1', name: '动画 1', durationMs: -5, playbackMode: 'play-once' },
    }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const issue = result.issues.find((item) => item.code === 'animation.invalid-duration')
      expect(issue?.path).toEqual(['animation', 'durationMs'])
    }
  })

  it('按名称后缀识别动画文件且纯后缀不算动画', () => {
    expect(isComposeAnimationFileName('Home.animation.json')).toBe(true)
    expect(isComposeAnimationFileName('.animation.json')).toBe(false)
    expect(isComposeAnimationFileName('Home.page.json')).toBe(false)
  })

  it('显示名与文件名互相规范化', () => {
    expect(composeAnimationDisplayName('Home.animation.json')).toBe('Home')
    expect(composeAnimationFileName('Home')).toBe('Home.animation.json')
    expect(composeAnimationFileName('Home.animation.json')).toBe('Home.animation.json')
  })
})
