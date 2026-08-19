import { describe, expect, it } from 'vitest'
import {
  composeAnimationDisplayName,
  composeAnimationFileName,
  createComposeAnimationFile,
  getComposeAnimationFileFrame,
  isComposeAnimationFileName,
  migrateComposeAnimationFileV1ToV2,
  parseComposeAnimationFile,
  serializeComposeAnimationFile,
  setComposeAnimationFileFrame,
} from './animation-file'

const SCENE_A = 'frame-root'
const SCENE_B = 'frame-2'

describe('动画文件格式', () => {
  it('序列化与解析往返后清单逐字段相等且没有 issue', () => {
    const file = createComposeAnimationFile(SCENE_A, {
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

  it('多块场景各自的清单往返后仍归属原分区', () => {
    const file = setComposeAnimationFileFrame(
      createComposeAnimationFile(SCENE_A, { id: 'anim-a', name: 'A 的动画' }),
      SCENE_B,
      [{ id: 'anim-b', name: 'B 的动画', durationMs: 800, playbackMode: 'loop' }],
    )
    const result = parseComposeAnimationFile(serializeComposeAnimationFile(file))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(getComposeAnimationFileFrame(result.file, SCENE_A)[0]?.id).toBe('anim-a')
    expect(getComposeAnimationFileFrame(result.file, SCENE_B)[0]?.id).toBe('anim-b')
  })

  it('构造器缺省时长与播放模式对齐编辑器默认值', () => {
    const file = createComposeAnimationFile(SCENE_A, { id: 'anim-1', name: '动画 1' })
    expect(getComposeAnimationFileFrame(file, SCENE_A)[0]?.durationMs).toBe(300)
    expect(getComposeAnimationFileFrame(file, SCENE_A)[0]?.playbackMode).toBe('play-once')
  })

  it('写入空清单即删除该分区，其余分区不受影响', () => {
    const file = setComposeAnimationFileFrame(
      createComposeAnimationFile(SCENE_A, { id: 'anim-a', name: 'A' }),
      SCENE_B,
      [{ id: 'anim-b', name: 'B', durationMs: 300, playbackMode: 'play-once' }],
    )
    const cleared = setComposeAnimationFileFrame(file, SCENE_B, [])
    expect(Object.keys(cleared.frames)).toEqual([SCENE_A])
    // 入参不被修改。
    expect(Object.keys(file.frames)).toContain(SCENE_B)
  })

  it('未分区的 Frame 读到空数组', () => {
    const file = createComposeAnimationFile(SCENE_A, { id: 'anim-1', name: '动画 1' })
    expect(getComposeAnimationFileFrame(file, SCENE_B)).toEqual([])
  })

  it('拒绝非法 JSON 并返回结构化 issue', () => {
    const result = parseComposeAnimationFile('{not json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]?.code).toBe('animation-file.invalid-json')
  })

  it('拒绝未知版本', () => {
    const file = createComposeAnimationFile(SCENE_A, { id: 'anim-1', name: '动画 1' })
    const text = serializeComposeAnimationFile(file)
      .replace('"animationSchemaVersion": 2', '"animationSchemaVersion": 3')
    const result = parseComposeAnimationFile(text)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'animation-file.unsupported-version'))
        .toBe(true)
    }
  })

  it('拒绝未知字段、错误 kind 与缺失分区', () => {
    const result = parseComposeAnimationFile(JSON.stringify({
      kind: 'compose-page',
      animationSchemaVersion: 2,
      extra: true,
    }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const codes = result.issues.map((issue) => issue.code)
      expect(codes).toContain('animation-file.invalid-shape')
      expect(result.issues.some((issue) => issue.path[0] === 'frames')).toBe(true)
    }
  })

  it('分区不是数组时报告该分区路径', () => {
    const result = parseComposeAnimationFile(JSON.stringify({
      kind: 'compose-animation',
      animationSchemaVersion: 2,
      frames: { [SCENE_A]: { id: 'anim-1' } },
    }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]?.path).toEqual(['frames', SCENE_A])
  })

  it('清单字段非法时按文件内路径报告 issue', () => {
    const result = parseComposeAnimationFile(JSON.stringify({
      kind: 'compose-animation',
      animationSchemaVersion: 2,
      frames: {
        [SCENE_A]: [{ id: 'anim-1', name: '动画 1', durationMs: -5, playbackMode: 'play-once' }],
      },
    }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const issue = result.issues.find((item) => item.code === 'animation.invalid-duration')
      expect(issue?.path).toEqual(['frames', SCENE_A, 0, 'durationMs'])
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

describe('OpenSpec: scene-animation / 动画文件格式 / 动画文件 1 到 2 显式迁移', () => {
  const legacy = {
    kind: 'compose-animation',
    animationSchemaVersion: 1,
    animation: { id: 'anim-1', name: '入场', durationMs: 1200, playbackMode: 'loop' },
  }

  it('原清单出现在指定 Frame 的分区里', () => {
    const result = migrateComposeAnimationFileV1ToV2(legacy, SCENE_B)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.file.animationSchemaVersion).toBe(2)
    expect(getComposeAnimationFileFrame(result.file, SCENE_B)).toEqual([legacy.animation])
    // 迁移不修改输入。
    expect(legacy.animationSchemaVersion).toBe(1)
  })

  it('普通解析对 v1 文件返回结构化 issue', () => {
    const result = parseComposeAnimationFile(JSON.stringify(legacy))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'animation-file.unsupported-version'))
        .toBe(true)
    }
  })

  it('迁移入口拒绝非 v1 输入与空 Frame id', () => {
    expect(migrateComposeAnimationFileV1ToV2({ animationSchemaVersion: 2 }, SCENE_A).ok).toBe(false)
    expect(migrateComposeAnimationFileV1ToV2(legacy, '').ok).toBe(false)
  })
})
