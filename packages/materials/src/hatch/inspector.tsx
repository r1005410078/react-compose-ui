import { getComposeHatch } from '@compose-ui/core'
import type { ComponentType } from 'react'
import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
import { ComposeButton } from '@compose-ui/components'
import { useZh } from '../material-inspector-kit/use-zh'

/**
 * 创建 Hatch Component Inspector。
 *
 * @remarks
 * `Hatch` 只存一个 `seed`，因此这里只有两件事：把那个落点读出来，以及给一条**显式的**重新
 * 生成入口。填充色不在这里——它是 `Appearance.backgroundPaint`，走既有的外观分组，因此数据
 * 绑定与外观动画轨道一样都不用做。
 *
 * **关联是手动的**，这是 v1 的决定而不是欠账：AutoCAD 关联图案填充最常被抱怨的失败正是那个
 * 存下来的落点——边界挪了之后落点掉到界外，填充**静默**留在原地，通常图印出来才发现。因此
 * 「关联可以晚点做，过期状态不能晚点做」：这里先把过期说出来。
 *
 * 求解不在本包（`materials` 不依赖 `stage-engine`），由宿主经 `hatchEditPort` 注入；端口缺席
 * 时只显示 `seed`，本包因此仍可独立嵌入。
 *
 * @internal
 */
export function createHatchInspector(): ComponentType<ComposeComponentInspectorProps> {
  return function HatchInspector({ entity, hatchEditPort, readOnly }) {
    const zh = useZh()
    // 读取走 core 的唯一入口，而不是直接摸 `value`：缺席即不是填充这条判断只该有一处。
    const hatch = getComposeHatch(entity)
    if (!hatch) return null
    const stale = hatchEditPort?.isStale({ entityId: entity.id }) ?? false
    return (
      <dl aria-label={zh ? '填充属性' : 'Hatch properties'} className="compose-material-hatch">
        <div className="compose-material-hatch__row">
          <dt>{zh ? '取点' : 'Seed'}</dt>
          {/* 只读：`seed` 是当初那一下点在哪儿，不是一个可以调的参数。要换位置就再填一次。 */}
          <dd data-testid="compose-material-hatch-seed">
            {`${hatch.seed.x}, ${hatch.seed.y}`}
          </dd>
        </div>
        <div className="compose-material-hatch__row">
          <dt>{zh ? '状态' : 'State'}</dt>
          <dd
            data-hatch-state={stale ? 'stale' : 'current'}
            data-testid="compose-material-hatch-state"
          >
            {stale
              ? (zh ? '边界已改，填充已过期' : 'Boundary changed; fill is out of date')
              : (zh ? '与边界一致' : 'Matches the boundary')}
          </dd>
        </div>
        {/*
          * 端口缺席时不画按钮：一个按下去什么都不会发生的入口比没有更糟，与导线 Inspector
          * 「自由端不给解除按钮」是同一条判断。
          */}
        {hatchEditPort ? (
          <ComposeButton
            data-testid="compose-material-hatch-regenerate"
            disabled={readOnly}
            size="sm"
            variant="ghost"
            onClick={() => hatchEditPort.regenerate({ entityId: entity.id })}
          >
            {zh ? '重新生成' : 'Regenerate'}
          </ComposeButton>
        ) : null}
      </dl>
    )
  }
}
