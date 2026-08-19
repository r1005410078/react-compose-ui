import type { ComposeEntityPreset } from '@compose-ui/component-registry'
import {
  COMPOSE_DEFAULT_FRAME_SIZE,
  COMPOSE_DEFAULT_SCENE_APPEARANCE,
  createComposeFrame,
} from '@compose-ui/core'
import type { ComposeBasicContainerOptions } from '../types'
import { ComposeContainerMaterialIcon } from '../material-icons'
import { createContainerPreset } from '../container/preset'

/**
 * 创建场景 Entity Preset。
 *
 * @remarks
 * 场景就是放在顶层的容器，所以这里直接复用 Container Preset 的组件再加 `Frame`，图标也是
 * 同一个。它存在的理由是文档里的 `Composition.presetId` 是 `'frame'`：没有这条注册，场景树
 * 等按 presetId 取图标的位置会掉到通用兜底图标。
 *
 * 外观改用 core 的场景默认值而不是容器默认值：两者背景相同，但场景不带默认边框（原因见
 * `COMPOSE_DEFAULT_SCENE_APPEARANCE` 的说明）。
 *
 * `paletteHidden`：场景由"在场景外画一个容器"或具名动作产生，从物料面板拖出一块场景没有
 * 意义——落点在某块场景里时它只会变成一个嵌套 Frame。
 *
 * @internal
 */
export function createFramePreset(
  options: ComposeBasicContainerOptions = {},
): ComposeEntityPreset {
  // 场景默认尺寸是画板尺寸而不是容器尺寸；LayoutItem 的固定尺寸回退必须与 Frame.size 一致，
  // 否则降格回普通容器时尺寸会跳到一个陌生的值。
  const size = options.defaultSize ?? COMPOSE_DEFAULT_FRAME_SIZE
  // 场景默认不裁剪：它是绝对坐标原点与工作区里的画板，内容越界默认可见——与「新建场景」
  // 命令及初始场景一致；需要裁剪时由用户在溢出属性里显式开启。容器保持默认裁剪不变。
  const container = createContainerPreset({ ...options, defaultSize: size, defaultClip: false })
  return {
    id: 'frame',
    label: '场景',
    defaultName: '场景',
    icon: <ComposeContainerMaterialIcon />,
    paletteHidden: true,
    createComponents: () => ({
      ...container.createComponents(),
      Appearance: { ...COMPOSE_DEFAULT_SCENE_APPEARANCE },
      Frame: createComposeFrame(size),
    }),
  }
}

/** 默认场景 Entity Preset。 @public */
export const DEFAULT_COMPOSE_FRAME_PRESET = createFramePreset()
