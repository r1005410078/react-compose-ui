import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const workspaceRoot = process.cwd()
const packageRoot = join(workspaceRoot, 'packages')
const forbiddenDirectoryNames = new Set([
  'components', 'hooks', 'types', 'utils', 'common', 'shared', 'helpers',
])
const visualPackages = new Set([
  'asset-browser', 'command-panel', 'component-registry', 'components', 'editor',
  'history', 'materials', 'operation-log', 'preview', 'property-panel',
  'scene-tree', 'stage', 'ui-context',
])
const requiredVisualFeatures = {
  'asset-browser': ['asset-browser/compose-asset-browser.tsx'],
  'command-panel': ['command-panel/compose-command-panel.tsx'],
  'component-registry': ['registry-renderers/compose-registry-renderers.tsx'],
  components: ['tree/tree.tsx'],
  editor: ['compose-editor/compose-editor.tsx'],
  history: ['history-panel/compose-history-panel.tsx'],
  'operation-log': ['operation-log-panel/compose-operation-log-panel.tsx'],
  preview: ['compose-preview/compose-preview.tsx'],
  'property-panel': ['property-panel/compose-property-panel.tsx'],
  'scene-tree': ['scene-tree/compose-scene-tree.tsx'],
  stage: [
    'stage-surface/compose-stage.tsx',
    'component-palette/compose-component-palette.tsx',
  ],
}

/** 仅检查源码布局，不解析 TypeScript；规则刻意保持可读且能给出精确路径。 */
function visit(directory, findings) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const path = join(directory, entry.name)
    if (forbiddenDirectoryNames.has(entry.name)) {
      findings.push(`${relative(workspaceRoot, path)} 使用了禁止的无语义目录名“${entry.name}”`)
    }
    visit(path, findings)
  }
}

function hasSibling(directory, suffix) {
  return readdirSync(directory, { withFileTypes: true })
    .some((entry) => entry.isFile() && entry.name.endsWith(suffix))
}

function collectSourceFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) collectSourceFiles(path, files)
    else if (/\.(?:[cm]?ts|tsx)$/.test(entry.name)) files.push(path)
  }
  return files
}

const findings = []
for (const packageName of readdirSync(packageRoot)) {
  if (!visualPackages.has(packageName)) continue
  const sourceRoot = join(packageRoot, packageName, 'src')
  if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) continue
  visit(sourceRoot, findings)
  const rootEntry = ['index.tsx', 'index.ts']
    .map((file) => join(sourceRoot, file))
    .find(existsSync)
  if (!rootEntry) {
    findings.push(`packages/${packageName}/src 缺少唯一公共入口 index.ts(x)`)
    continue
  }
  const source = readFileSync(rootEntry, 'utf8')
  if (/\bfunction\s+Compose[A-Z]|\bconst\s+Compose[A-Z]|\bclass\s+Compose[A-Z]/.test(source)) {
    findings.push(`${relative(workspaceRoot, rootEntry)} 必须只作为公共导出入口，不能实现视觉组件`)
  }

  for (const featureFile of requiredVisualFeatures[packageName] ?? []) {
    const featurePath = join(sourceRoot, featureFile)
    if (!existsSync(featurePath)) {
      findings.push(`packages/${packageName}/src/${featureFile} 缺少公开视觉组件功能入口`)
      continue
    }
    const featureDirectory = featurePath.slice(0, featurePath.lastIndexOf('/'))
    if (!hasSibling(featureDirectory, '.test.tsx')) {
      findings.push(`${relative(workspaceRoot, featureDirectory)} 缺少共置组件契约测试`)
    }
    if (!hasSibling(featureDirectory, '.stories.tsx')) {
      findings.push(`${relative(workspaceRoot, featureDirectory)} 缺少共置 Storybook Story`)
    }
  }

  for (const sourceFile of collectSourceFiles(sourceRoot)) {
    const sourceText = readFileSync(sourceFile, 'utf8')
    const matches = sourceText.matchAll(/from\s+['"](@compose-ui\/[^'"]+)['"]/g)
    for (const match of matches) {
      const importPath = match[1]
      if (!importPath) continue
      const [, packageAndSubpath] = importPath.split('@compose-ui/')
      const segments = packageAndSubpath?.split('/') ?? []
      const subpath = segments.slice(1).join('/')
      if (subpath && subpath !== 'styles.css') {
        findings.push(
          `${relative(workspaceRoot, sourceFile)} 禁止跨包私有路径导入“${importPath}”`,
        )
      }
    }
  }
}

if (findings.length > 0) {
  console.error('React 组件目录架构检查失败：')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exitCode = 1
}
