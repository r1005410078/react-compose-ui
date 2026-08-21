import type { ComposeCommandDefinition } from './command-types'

/** 可按名称解析的命令集合。 @public */
export interface ComposeCommandRegistry<TContext, TEffect> {
  readonly commands: readonly ComposeCommandDefinition<TContext, TEffect>[]
  /** 按 id 或别名解析；未命中时返回 `null`。 */
  resolve(text: string): ComposeCommandDefinition<TContext, TEffect> | null
}

function normalize(text: string) {
  return text.trim().toUpperCase()
}

/**
 * 建立命令注册表。
 *
 * @remarks
 * id 与别名共用同一个大小写无关的命名空间——AutoCAD 里 `LINE` 与 `L` 是同一条命令的两种写法，
 * 分成两张表会让「这个词有没有被占用」需要查两处。
 *
 * @throws 当 id 或别名重复时抛错：重名会让「键入这个词到底执行哪条命令」无法从注册处读出。
 * @public
 */
export function createComposeCommandRegistry<TContext, TEffect>(
  commands: readonly ComposeCommandDefinition<TContext, TEffect>[],
): ComposeCommandRegistry<TContext, TEffect> {
  const index = new Map<string, ComposeCommandDefinition<TContext, TEffect>>()
  for (const command of commands) {
    for (const name of [command.id, ...(command.aliases ?? [])]) {
      const key = normalize(name)
      if (key.length === 0) throw new Error(`Command name must not be empty: ${command.id}`)
      if (index.has(key)) throw new Error(`Duplicate command name: ${name}`)
      index.set(key, command)
    }
  }
  return {
    commands,
    resolve: (text) => index.get(normalize(text)) ?? null,
  }
}

/**
 * 在注册表中解析一个命令名。
 *
 * @returns 命中的命令，未命中时为 `null`。
 * @public
 */
export function resolveComposeCommand<TContext, TEffect>(
  registry: ComposeCommandRegistry<TContext, TEffect>,
  text: string,
) {
  return registry.resolve(text)
}
