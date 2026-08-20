import { createStagePaintPlugin } from './paint-plugin'
import { createStagePaintSamplePlugin } from './paint-sample-plugin'
import { createStagePanPlugin } from './pan-plugin'
import { createStagePathPlugin } from './path-plugin'
import { createStageRotatePlugin } from './rotate-plugin'
import { createStageTextEditGuardPlugin } from './text-edit-guard-plugin'
import type { StageInteractionPlugin } from './kernel-types'

/**
 * 已经从 legacy 单体中抽出的插件工厂，按优先级自顶向下排列。
 *
 * @remarks
 * 这份清单是**唯一**的登记处：controller 用它组装注册表，抽取顺序不变量测试也用它推导
 * 「已抽取集合」。两边共用一个来源，新增插件时不可能只改一处——先前把已抽取集合手抄进
 * 测试的写法，在 rotate 与 paint-sample 落地时就悄悄过期了，守卫等于失效。
 *
 * 数组顺序不参与仲裁（注册表按 `priority` 排序），它只是让这里的清单与优先级表能逐行对照。
 *
 * @public
 */
export const STAGE_EXTRACTED_PLUGIN_FACTORIES: readonly (() => StageInteractionPlugin)[] = [
  createStageTextEditGuardPlugin,
  createStagePanPlugin,
  createStageRotatePlugin,
  createStagePaintSamplePlugin,
  createStagePathPlugin,
  createStagePaintPlugin,
]
