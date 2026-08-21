import { describe, expect, it } from 'vitest'
import { createComposeCommandRegistry, resolveComposeCommand } from './command-registry'
import type { ComposeCommandDefinition } from './command-types'

function command(id: string, aliases?: readonly string[]): ComposeCommandDefinition<null, null> {
  return {
    id,
    aliases,
    title: id,
    start: () => ({
      prompt: { message: id, accepts: ['point'] },
      advance: () => ({ status: 'cancelled' }),
    }),
  }
}

describe('命令注册与解析', () => {
  it('OpenSpec: commands / 多步提示命令会话 / 命令由文本启动并按别名解析', () => {
    const registry = createComposeCommandRegistry([command('LINE', ['L']), command('CIRCLE', ['C'])])
    expect(resolveComposeCommand(registry, 'l')?.id).toBe('LINE')
    expect(resolveComposeCommand(registry, '  Line  ')?.id).toBe('LINE')
    expect(resolveComposeCommand(registry, 'C')?.id).toBe('CIRCLE')
    expect(resolveComposeCommand(registry, 'ARC')).toBeNull()
    expect(resolveComposeCommand(registry, '')).toBeNull()
  })

  it('id 与别名共用一个命名空间，重名在建表时就失败', () => {
    expect(() => createComposeCommandRegistry([command('LINE'), command('L', ['LINE'])]))
      .toThrow(/Duplicate command name: LINE/)
    expect(() => createComposeCommandRegistry([command('LINE', ['L']), command('CIRCLE', ['l'])]))
      .toThrow(/Duplicate command name: l/)
    expect(() => createComposeCommandRegistry([command('LINE', ['  '])]))
      .toThrow(/must not be empty/)
  })
})
