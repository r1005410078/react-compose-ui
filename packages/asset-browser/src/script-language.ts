import { extensionOf } from './asset-file-utils'

const languageByExtension: Readonly<Record<string, string>> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  css: 'css',
  scss: 'scss',
  html: 'html',
  md: 'markdown',
}

/**
 * 返回 Asset Browser 内建脚本扩展名对应的 Monaco language ID。
 *
 * @public
 */
export function getAssetScriptLanguage(name: string) {
  return languageByExtension[extensionOf(name)] ?? 'plaintext'
}
