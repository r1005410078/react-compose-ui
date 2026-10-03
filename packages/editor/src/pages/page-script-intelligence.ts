import type { ComposeScriptIntelligenceProfile } from '@compose-ui/asset-browser'
import {
  COMPOSE_PAGE_SCRIPT_TYPE_DECLARATIONS,
  COMPOSE_PORTABLE_UNAVAILABLE_GLOBALS,
} from '@compose-ui/script-runtime'

const SETUP_PARAMETER_TYPE = '/** @type {ComposePageScriptContext} */ '

function maskJavaScriptLiterals(source: string) {
  const output = [...source]
  let state: 'code' | 'line-comment' | 'block-comment' | 'single' | 'double' | 'template' = 'code'
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!
    const next = source[index + 1]

    if (state === 'code') {
      if (character === '/' && next === '/') {
        output[index] = ' '
        output[index + 1] = ' '
        state = 'line-comment'
        index += 1
      } else if (character === '/' && next === '*') {
        output[index] = ' '
        output[index + 1] = ' '
        state = 'block-comment'
        index += 1
      } else if (character === "'") {
        output[index] = ' '
        state = 'single'
      } else if (character === '"') {
        output[index] = ' '
        state = 'double'
      } else if (character === '`') {
        output[index] = ' '
        state = 'template'
      }
      continue
    }

    if (character !== '\n' && character !== '\r') output[index] = ' '
    if (state === 'line-comment') {
      if (character === '\n' || character === '\r') state = 'code'
      continue
    }
    if (state === 'block-comment') {
      if (character === '*' && next === '/') {
        output[index + 1] = ' '
        state = 'code'
        index += 1
      }
      continue
    }
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      continue
    }
    if ((state === 'single' && character === "'")
      || (state === 'double' && character === '"')
      || (state === 'template' && character === '`')) {
      state = 'code'
    }
  }
  return output.join('')
}

const SETUP_EXPORT_PATTERNS = [
  /\bexport\s+function\s+setup\s*\(\s*([A-Za-z_$][\w$]*)/,
  /\bexport\s+const\s+setup\s*=\s*\(\s*([A-Za-z_$][\w$]*)/,
  /\bexport\s+const\s+setup\s*=\s*function\s*\(\s*([A-Za-z_$][\w$]*)/,
] as const

/** 定位标准页面 setup 直接导出的首个参数 UTF-16 offset。 @internal */
export function findComposePageSetupParameterOffset(source: string): number | null {
  const masked = maskJavaScriptLiterals(source)
  let first: number | null = null
  for (const pattern of SETUP_EXPORT_PATTERNS) {
    const match = pattern.exec(masked)
    const parameter = match?.[1]
    if (match?.index === undefined || !parameter) continue
    const offset = match.index + match[0].lastIndexOf(parameter)
    if (first === null || offset < first) first = offset
  }
  return first
}

function tsCheckInsertionOffset(source: string) {
  if (!source.startsWith('#!')) return 0
  const lineEnd = source.indexOf('\n')
  return lineEnd === -1 ? source.length : lineEnd + 1
}

/** 页面 Setup JavaScript 使用的稳定智能分析 Profile。 @internal */
export const COMPOSE_PAGE_SETUP_SCRIPT_INTELLIGENCE: ComposeScriptIntelligenceProfile = {
  id: 'compose-page-setup',
  language: 'javascript',
  typeDeclarations: COMPOSE_PAGE_SCRIPT_TYPE_DECLARATIONS,
  createVirtualInsertions(source) {
    const insertions = [{
      offset: tsCheckInsertionOffset(source),
      text: '// @ts-check\n',
    }]
    const parameterOffset = findComposePageSetupParameterOffset(source)
    if (parameterOffset !== null) {
      insertions.push({
        offset: parameterOffset,
        text: SETUP_PARAMETER_TYPE,
      })
    }
    return insertions.sort((left, right) => left.offset - right.offset)
  },
  getSourceDiagnostics(source) {
    if (findComposePageSetupParameterOffset(source) !== null) return []
    return [{
      offset: 0,
      length: Math.min(source.length, 1),
      message: '未识别标准 setup 导出；已保留普通 JavaScript 编辑能力。',
      severity: 'hint',
    }]
  },
}

/**
 * 找出脚本里对可移植宿主上不存在的浏览器全局的**自由引用**。
 *
 * @remarks
 * 只认自由引用：字符串与注释先遮掉；`x.document`（属性访问）、`{ document: 1 }`（对象键）与本文件
 * 里自己声明过的同名绑定都不算。这是词法近似而不是作用域分析——它宁可漏报也不误报，漏掉的那些
 * 在 Qt 里照样会以 `script.setup-threw` 诊断暴露，误报则会让作者对一条正确的代码无所适从。
 *
 * @internal
 */
export function findNonPortableGlobals(source: string): readonly { readonly offset: number; readonly name: string }[] {
  const masked = maskJavaScriptLiterals(source)
  const found: { offset: number; name: string }[] = []
  for (const name of COMPOSE_PORTABLE_UNAVAILABLE_GLOBALS) {
    if (new RegExp(`\\b(?:const|let|var|function|class)\\s+${name}\\b`).test(masked)) continue
    const pattern = new RegExp(`(^|[^.\\w$])(${name})(?![\\w$])`, 'g')
    for (let match = pattern.exec(masked); match; match = pattern.exec(masked)) {
      const offset = match.index + match[1]!.length
      const before = masked.slice(0, offset).trimEnd().slice(-1)
      const after = masked.slice(offset + name.length).trimStart()[0]
      if (after === ':' && (before === '{' || before === ',')) continue
      found.push({ offset, name })
    }
  }
  return found.sort((left, right) => left.offset - right.offset)
}

/**
 * 页面 Setup 的可移植模式 Profile：在标准 Profile 之上，把不可移植的浏览器全局标为错误。
 *
 * @remarks
 * 不靠关掉 DOM lib 实现：Monaco 的 JavaScript 语言服务配置被所有打开的 JS 编辑器共享，改它会把别的
 * 脚本一起改掉。改用 Profile 自己的源码诊断，只作用于这一个编辑器。
 *
 * @internal
 */
export const COMPOSE_PAGE_SETUP_PORTABLE_SCRIPT_INTELLIGENCE: ComposeScriptIntelligenceProfile = {
  ...COMPOSE_PAGE_SETUP_SCRIPT_INTELLIGENCE,
  id: 'compose-page-setup-portable',
  getSourceDiagnostics(source) {
    return [
      ...COMPOSE_PAGE_SETUP_SCRIPT_INTELLIGENCE.getSourceDiagnostics?.(source) ?? [],
      ...findNonPortableGlobals(source).map(({ offset, name }) => ({
        offset,
        length: name.length,
        message: `「${name}」在 Qt 中不可用：导出到 Qt 的页面脚本里不存在这个浏览器全局。`,
        severity: 'error' as const,
      })),
    ]
  },
}

/** 判断资源名是否遵循页面 Setup 脚本约定。 @internal */
export function isComposePageSetupScriptName(name: string) {
  return name.toLowerCase().endsWith('.setup.js')
}
