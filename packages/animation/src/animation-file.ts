import {
  type ComposeAnimation,
  type DocumentValidationIssueCode,
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  validateComposeDocument,
} from '@compose-ui/core'

/** 动画文件的名称后缀。 @public */
export const COMPOSE_ANIMATION_FILE_SUFFIX = '.animation.json' as const

/**
 * 动画文件的媒体类型。
 *
 * @remarks
 * 动画文件按名称后缀识别（{@link isComposeAnimationFileName}），Provider 不需要理解本
 * 媒体类型即可参与动画工作流；常量只为将来把命名约定翻译成协议元数据的适配层预留。
 * @public
 */
export const COMPOSE_ANIMATION_MEDIA_TYPE = 'application/vnd.compose-ui.animation+json' as const

/** 当前动画文件版本。 @public */
export const COMPOSE_ANIMATION_FILE_SCHEMA_VERSION = 1 as const

/**
 * 动画清单与变量绑定的版本化文件资产。
 *
 * @remarks
 * 文件只承载动画的身份、时间属性与播放控制绑定；关键帧轨道存放在被动画 Entity 的
 * `Animation` Component 上，复制、删除、Group 与组件继承因此自动携带动画。文件是静态
 * 权威：宿主打开页面时把清单水合进 `ComposeDocument.animations` 会话镜像，保存时把镜像
 * 变化回写文件。
 * @public
 */
export interface ComposeAnimationFile {
  readonly kind: 'compose-animation'
  readonly animationSchemaVersion: typeof COMPOSE_ANIMATION_FILE_SCHEMA_VERSION
  readonly animation: ComposeAnimation
}

/** 动画文件解析问题的稳定机器码。 @public */
export type ComposeAnimationFileIssueCode =
  | 'animation-file.invalid-json'
  | 'animation-file.invalid-shape'
  | 'animation-file.unsupported-version'
  | DocumentValidationIssueCode

/** 动画文件中一个可定位的问题。 @public */
export interface ComposeAnimationFileIssue {
  readonly code: ComposeAnimationFileIssueCode
  readonly path: readonly (string | number)[]
  readonly message: string
}

/** 动画文件解析的判别结果。 @public */
export type ComposeAnimationFileParseResult =
  | { readonly ok: true; readonly file: ComposeAnimationFile }
  | { readonly ok: false; readonly issues: readonly ComposeAnimationFileIssue[] }

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * 判断名称是否符合动画文件的命名约定。
 *
 * @remarks
 * 动画文件的身份判据就是名称后缀——与页面不同，动画工作流不要求 Provider 上报专门的
 * 媒体类型。纯后缀（名称恰好等于后缀）不算动画文件，否则会产生显示名为空的动画。
 * @public
 */
export function isComposeAnimationFileName(name: string): boolean {
  return name.length > COMPOSE_ANIMATION_FILE_SUFFIX.length
    && name.endsWith(COMPOSE_ANIMATION_FILE_SUFFIX)
}

/**
 * 取动画文件对应的用户可见显示名。
 *
 * @returns 去掉动画后缀后的名称；传入的不是动画文件时原样返回。
 * @public
 */
export function composeAnimationDisplayName(fileName: string): string {
  return isComposeAnimationFileName(fileName)
    ? fileName.slice(0, -COMPOSE_ANIMATION_FILE_SUFFIX.length)
    : fileName
}

/**
 * 由显示名生成动画文件名。
 *
 * @remarks
 * 已经带动画后缀的输入原样返回，因此可直接用于规范化用户输入——无论输入 `Home` 还是
 * `Home.animation.json` 都得到同一结果。
 * @public
 */
export function composeAnimationFileName(displayName: string): string {
  const trimmed = displayName.trim()
  return isComposeAnimationFileName(trimmed)
    ? trimmed
    : `${trimmed}${COMPOSE_ANIMATION_FILE_SUFFIX}`
}

/**
 * 校验单条动画清单。
 *
 * @remarks
 * core 的清单校验是 `validateComposeDocument` 的私有部分，这里不复制规则，而是把候选
 * 清单放进一份最小探针文档统一校验，再取回 `animations[0]` 下的问题。这保证文件内清单
 * 与文档内镜像遵守完全相同的约束，两边不会漂移。
 */
function validateAnimationManifest(
  candidate: unknown,
  issues: ComposeAnimationFileIssue[],
): candidate is ComposeAnimation {
  const probe = {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: [],
    entities: {},
    animations: [candidate],
  }
  const validation = validateComposeDocument(probe)
  if (validation.valid) return true
  let manifestInvalid = false
  validation.issues.forEach((issue) => {
    if (issue.path[0] !== 'animations') return
    manifestInvalid = true
    issues.push({
      code: issue.code,
      // 探针文档中的 ['animations', 0, ...] 对应文件里的 ['animation', ...]。
      path: ['animation', ...issue.path.slice(2)],
      message: issue.message,
    })
  })
  return !manifestInvalid
}

/**
 * 解析动画文件文本。
 *
 * @remarks
 * 解析失败不抛异常，而是返回带 issue 的判别结果，使调用方能把原因呈现给用户；
 * 存在任何 issue 时不产生部分解析结果。
 * @public
 */
export function parseComposeAnimationFile(text: string): ComposeAnimationFileParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  }
  catch (error) {
    return {
      ok: false,
      issues: [{
        code: 'animation-file.invalid-json',
        path: [],
        message: `动画文件不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
      }],
    }
  }
  if (!isRecord(parsed)) {
    return {
      ok: false,
      issues: [{ code: 'animation-file.invalid-shape', path: [], message: '动画文件必须是对象' }],
    }
  }
  const issues: ComposeAnimationFileIssue[] = []
  const allowed = new Set(['kind', 'animationSchemaVersion', 'animation'])
  Object.keys(parsed).forEach((key) => {
    if (!allowed.has(key)) {
      issues.push({
        code: 'animation-file.invalid-shape',
        path: [key],
        message: `动画文件包含未知字段 ${key}`,
      })
    }
  })
  if (parsed.kind !== 'compose-animation') {
    issues.push({
      code: 'animation-file.invalid-shape',
      path: ['kind'],
      message: '动画文件 kind 必须为 compose-animation',
    })
  }
  if (parsed.animationSchemaVersion !== COMPOSE_ANIMATION_FILE_SCHEMA_VERSION) {
    issues.push({
      code: 'animation-file.unsupported-version',
      path: ['animationSchemaVersion'],
      message: `不支持动画文件版本 ${String(parsed.animationSchemaVersion)}`,
    })
  }
  validateAnimationManifest(parsed.animation, issues)
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, file: parsed as unknown as ComposeAnimationFile }
}

/**
 * 序列化动画文件为文本。
 *
 * @remarks
 * 使用两空格缩进并以换行结尾，使动画文件在只读 JSON 查看与外部 diff 中可读。
 * @public
 */
export function serializeComposeAnimationFile(file: ComposeAnimationFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}

/**
 * 用清单构造一份动画文件。
 *
 * @remarks
 * 时长与播放模式缺省对齐编辑器创建动画的默认值（300 ms、`play-once`）。
 * @public
 */
export function createComposeAnimationFile(
  animation: Pick<ComposeAnimation, 'id' | 'name'> & Partial<ComposeAnimation>,
): ComposeAnimationFile {
  return {
    kind: 'compose-animation',
    animationSchemaVersion: COMPOSE_ANIMATION_FILE_SCHEMA_VERSION,
    animation: {
      durationMs: 300,
      playbackMode: 'play-once',
      ...animation,
    },
  }
}
