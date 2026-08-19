import {
  type ComposeAnimation,
  type DocumentValidationIssueCode,
  createComposeFrame,
  createDefaultCanvasSettings,
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
export const COMPOSE_ANIMATION_FILE_SCHEMA_VERSION = 2 as const

/**
 * 动画清单与变量绑定的版本化文件资产。
 *
 * @remarks
 * 文件只承载动画的身份、时间属性与播放控制绑定；关键帧轨道存放在被动画 Entity 的
 * `Animation` Component 上，复制、删除、Group 与组件继承因此自动携带动画。
 *
 * 清单按**所属根 Frame** 分区：一个页面的多块场景共用一份文件，各自的动画互不影响，
 * 因此不需要随场景数量增生文件、也不需要一套动画文件命名策略。分区键是该 Frame 的
 * Entity id，与 `Animations.source` 挂在 Frame 上是同一种耦合，不是新增约束。
 *
 * 文件是静态权威：宿主打开页面时把各分区水合进对应 Frame 的 `Animations.items` 会话镜像，
 * 保存时把各镜像的变化合并回写同一份文件。
 * @public
 */
export interface ComposeAnimationFile {
  readonly kind: 'compose-animation'
  readonly animationSchemaVersion: typeof COMPOSE_ANIMATION_FILE_SCHEMA_VERSION
  /** 按所属根 Frame 的 Entity id 分区的清单；值与该 Frame 的 `Animations.items` 一一对应。 */
  readonly frames: Readonly<Record<string, readonly ComposeAnimation[]>>
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
 * 校验一个 Frame 分区的动画清单。
 *
 * @remarks
 * core 的清单校验是 `validateComposeDocument` 的私有部分，这里不复制规则，而是把候选清单
 * 放进一份最小探针文档的根 Frame 上统一校验，再取回该清单下的问题。这保证文件内清单与
 * 文档内镜像遵守完全相同的约束，两边不会漂移。
 */
function validateFrameManifest(
  frameKey: string,
  candidate: unknown,
  issues: ComposeAnimationFileIssue[],
): boolean {
  if (!Array.isArray(candidate)) {
    issues.push({
      code: 'animation-file.invalid-shape',
      path: ['frames', frameKey],
      message: `Frame ${frameKey} 的清单必须是数组`,
    })
    return false
  }
  const frameId = 'probe-frame'
  const frame = createComposeFrame()
  const probe = {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: [frameId],
    entities: {
      [frameId]: {
        id: frameId,
        name: frameId,
        components: {
          Composition: {
            presetId: 'frame',
            baseComponentKeys: [
              'Composition',
              'Transform',
              'LayoutItem',
              'Visibility',
              'Lock',
              'Hierarchy',
              'Frame',
              'Animations',
            ],
            capabilityIds: [],
          },
          Transform: { rotation: 0 },
          LayoutItem: {
            positioning: 'absolute',
            offset: { x: 0, y: 0 },
            width: { mode: 'fixed', value: frame.size.width, min: 1, max: null },
            height: { mode: 'fixed', value: frame.size.height, min: 1, max: null },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            alignSelf: 'auto',
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Hierarchy: { childIds: [] },
          Frame: frame,
          Animations: { items: candidate },
        },
      },
    },
  }
  const manifestPath = ['entities', frameId, 'components', 'Animations', 'items']
  const validation = validateComposeDocument(probe)
  if (validation.valid) return true
  let manifestInvalid = false
  validation.issues.forEach((issue) => {
    const inManifest = manifestPath.every((segment, index) => issue.path[index] === segment)
    if (!inManifest) return
    manifestInvalid = true
    issues.push({
      code: issue.code,
      // 探针中的 [...Animations, 'items', i, ...] 对应文件里的 ['frames', frameKey, i, ...]。
      path: ['frames', frameKey, ...issue.path.slice(manifestPath.length)],
      message: issue.message,
    })
  })
  return !manifestInvalid
}

/** 校验分区表本身的形状，并逐个分区校验清单。 */
function validateFramePartitions(
  candidate: unknown,
  issues: ComposeAnimationFileIssue[],
): void {
  if (!isRecord(candidate)) {
    issues.push({
      code: 'animation-file.invalid-shape',
      path: ['frames'],
      message: '动画文件 frames 必须是对象',
    })
    return
  }
  Object.entries(candidate).forEach(([frameKey, items]) => {
    if (frameKey.length === 0) {
      issues.push({
        code: 'animation-file.invalid-shape',
        path: ['frames', frameKey],
        message: '动画文件的分区键必须是非空 Frame id',
      })
      return
    }
    validateFrameManifest(frameKey, items, issues)
  })
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
  const allowed = new Set(['kind', 'animationSchemaVersion', 'frames'])
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
  validateFramePartitions(parsed.frames, issues)
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
 * 用某块 Frame 的清单构造一份动画文件。
 *
 * @remarks
 * 时长与播放模式缺省对齐编辑器创建动画的默认值（300 ms、`play-once`）。
 * @param frameId - 该动画所属根 Frame 的 Entity id。
 * @public
 */
export function createComposeAnimationFile(
  frameId: string,
  animation: Pick<ComposeAnimation, 'id' | 'name'> & Partial<ComposeAnimation>,
): ComposeAnimationFile {
  return {
    kind: 'compose-animation',
    animationSchemaVersion: COMPOSE_ANIMATION_FILE_SCHEMA_VERSION,
    frames: {
      [frameId]: [{
        durationMs: 300,
        playbackMode: 'play-once',
        ...animation,
      }],
    },
  }
}

/**
 * 读取某个 Frame 分区的清单。
 *
 * @returns 该 Frame 没有分区时返回空数组；调用方因此不需要各自写 `?? []`。
 * @public
 */
export function getComposeAnimationFileFrame(
  file: ComposeAnimationFile,
  frameId: string,
): readonly ComposeAnimation[] {
  return file.frames[frameId] ?? []
}

/**
 * 改写某个 Frame 分区的清单。
 *
 * @remarks
 * 传空数组即删除该分区——空分区与「这块场景没有动画」是同一件事，留着只会让文件里堆积
 * 无意义的空键。其余分区原样保留，因此保存时可以逐块合并回同一份文件。
 *
 * @returns 新文件对象；入参不被修改。
 * @public
 */
export function setComposeAnimationFileFrame(
  file: ComposeAnimationFile,
  frameId: string,
  items: readonly ComposeAnimation[],
): ComposeAnimationFile {
  const frames = { ...file.frames }
  if (items.length === 0) delete frames[frameId]
  else frames[frameId] = [...items]
  return { ...file, frames }
}

/**
 * 把动画文件 1 显式迁移到 2。
 *
 * @remarks
 * v1 只装一条清单、不知道自己属于哪块场景，因此迁移必须由调用方指定归属 Frame——通常是
 * 引用该文件的那个 Frame。迁移是纯函数：入参不被修改，结果仍走完整校验。
 *
 * @param input - 已解析的 v1 文件 JSON 值。
 * @param frameId - 迁移后清单归属的根 Frame Entity id。
 * @public
 */
export function migrateComposeAnimationFileV1ToV2(
  input: unknown,
  frameId: string,
): ComposeAnimationFileParseResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{
        code: 'animation-file.invalid-shape',
        path: [],
        message: '动画文件必须是对象',
      }],
    }
  }
  if (input.animationSchemaVersion !== 1) {
    return {
      ok: false,
      issues: [{
        code: 'animation-file.unsupported-version',
        path: ['animationSchemaVersion'],
        message: `迁移入口只接受动画文件版本 1，收到 ${String(input.animationSchemaVersion)}`,
      }],
    }
  }
  if (frameId.length === 0) {
    return {
      ok: false,
      issues: [{
        code: 'animation-file.invalid-shape',
        path: ['frames'],
        message: '迁移必须指定归属 Frame id',
      }],
    }
  }
  const { animation, ...rest } = input
  return parseComposeAnimationFile(JSON.stringify({
    ...rest,
    animationSchemaVersion: COMPOSE_ANIMATION_FILE_SCHEMA_VERSION,
    frames: { [frameId]: [animation] },
  }))
}
