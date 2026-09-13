import { getComposeHatch } from '@compose-ui/core'
import type { ComponentType } from 'react'
import type {
  ComposeComponentInspectorProps,
  ComposeHatchState,
} from '@compose-ui/component-registry'
import { ComposeButton } from '@compose-ui/components'
import { useZh } from '../material-inspector-kit/use-zh'

/** 三档各自的一句话；三句 MUST 互不相同。 */
const STATE_TEXT: Record<ComposeHatchState, { readonly zh: string; readonly en: string }> = {
  current: { zh: '与边界一致', en: 'Matches the boundary' },
  stale: { zh: '边界已改，填充已过期', en: 'Boundary changed; fill is out of date' },
  broken: { zh: '边界已断开', en: 'Boundary is broken' },
}

/**
 * 创建 Hatch Component Inspector。
 *
 * @remarks
 * `Hatch` 存锚点与边界清单，因此这里有三件事：把锚点读出来、说出这块填充与边界**现在是哪一
 * 档**、以及给「重新生成」与「断开关联」两条显式入口。填充色不在这里——它是
 * `Appearance.backgroundPaint`，走既有的外观分组，因此数据绑定与外观动画轨道一样都不用做。
 *
 * **三档而不是一个布尔**：「还跟着」「跟不上了」「边界没了」互不相同，与悬空的导线绑定
 * 「还没配 / 配错了 / 配的东西没了」是同一套判断。把后两档收成一个「过期」会让「按一下重新
 * 生成就好了」与「先去把那条缝补上」读起来是同一句话，而前者按一下就回来、后者按多少下都没用。
 *
 * 那一行读作**锚点**而不是「取点」：跟随成功时它会被重取到这块面的最大内切圆圆心，因此它表达
 * 的是**这块面的身份**，不是当初那一下点在哪儿。
 *
 * 求解不在本包（`materials` 不依赖 `stage-engine`），由宿主经 `hatchEditPort` 注入；端口缺席
 * 时只显示锚点、不画那两颗按钮，本包因此仍可独立嵌入。
 *
 * @internal
 */
export function createHatchInspector(): ComponentType<ComposeComponentInspectorProps> {
  return function HatchInspector({ entity, hatchEditPort, readOnly }) {
    const zh = useZh()
    // 读取走 core 的唯一入口，而不是直接摸 `value`：缺席即不是填充这条判断只该有一处。
    const hatch = getComposeHatch(entity)
    if (!hatch) return null
    const state = hatchEditPort?.state({ entityId: entity.id }) ?? 'current'
    return (
      <dl aria-label={zh ? '填充属性' : 'Hatch properties'} className="compose-material-hatch">
        <div className="compose-material-hatch__row">
          <dt>{zh ? '锚点' : 'Anchor'}</dt>
          {/* 只读：锚点是这块面的身份，由求解自己重取，不是一个可以调的参数。 */}
          <dd data-testid="compose-material-hatch-seed">
            {`${hatch.seed.x}, ${hatch.seed.y}`}
          </dd>
        </div>
        <div className="compose-material-hatch__row">
          <dt>{zh ? '状态' : 'State'}</dt>
          <dd
            data-hatch-state={state}
            data-testid="compose-material-hatch-state"
          >
            {zh ? STATE_TEXT[state].zh : STATE_TEXT[state].en}
          </dd>
        </div>
        {/*
          * 端口缺席时不画按钮：一个按下去什么都不会发生的入口比没有更糟，与导线 Inspector
          * 「自由端不给解除按钮」是同一条判断。两颗一起进出——它们答的是同一格上的同一件事。
          */}
        {hatchEditPort ? (
          <div className="compose-material-hatch__actions">
            <ComposeButton
              data-testid="compose-material-hatch-regenerate"
              disabled={readOnly}
              size="sm"
              variant="ghost"
              onClick={() => hatchEditPort.regenerate({ entityId: entity.id })}
            >
              {zh ? '重新生成' : 'Regenerate'}
            </ComposeButton>
            <ComposeButton
              data-testid="compose-material-hatch-detach"
              disabled={readOnly}
              size="sm"
              variant="ghost"
              onClick={() => hatchEditPort.detach({ entityId: entity.id })}
            >
              {zh ? '断开关联' : 'Detach'}
            </ComposeButton>
          </div>
        ) : null}
      </dl>
    )
  }
}
