import type { ComposeScriptIntelligenceProfile } from '@compose-ui/asset-browser'
import { COMPOSE_PAGE_SCRIPT_TYPE_DECLARATIONS } from '@compose-ui/script-runtime'

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

/** 判断资源名是否遵循页面 Setup 脚本约定。 @internal */
export function isComposePageSetupScriptName(name: string) {
  return name.toLowerCase().endsWith('.setup.js')
}
