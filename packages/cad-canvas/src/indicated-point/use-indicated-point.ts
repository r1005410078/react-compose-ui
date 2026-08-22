import { useCallback, useMemo, useState } from 'react'
import {
  findCadSnap,
  resolveCadPoint,
  type CadDocument,
  type CadInputPoint,
  type CadPointContext,
  type CadSnapCandidate,
} from '@compose-ui/cad'
import type { ComposeCommandPrompt } from '@compose-ui/commands'
import { cadScreenToWorld, type CadCanvasPoint, type CadViewport } from '../viewport'

/**
 * 当前被指示的点。
 *
 * @remarks
 * 十字光标、橡皮筋终点、坐标读数与捕捉标记 MUST 全部读这一个值。四个消费者各自解算会在
 * 某处拼歪，而那类缺陷表现成「橡皮筋和十字线差几个像素」，极难归因。
 *
 * @internal
 */
export interface CadIndicatedPoint {
  /** 指针相对图面的**屏幕**位置。 */
  readonly screen: CadCanvasPoint
  /** 产生这次指示的指针类型；触摸没有光标，十字光标据此不绘制。 */
  readonly pointerType: string
  /** 指针位置换算出的世界坐标，未经任何吸附。 */
  readonly raw: CadInputPoint
  /** 经点求解管线得到的世界落点；按下时提交的就是它。 */
  readonly world: CadInputPoint
  /** 对象捕捉命中的特征点；没有命中时为 `null`。 */
  readonly snap: CadSnapCandidate | null
}

/** {@link useCadIndicatedPoint} 的依赖。 @internal */
export interface CadIndicatedPointParams {
  readonly document: CadDocument
  readonly viewport: CadViewport
  /** 命令当前的提示；决定要不要求解对象捕捉。 */
  readonly prompt: ComposeCommandPrompt | null
  /** 除捕捉点以外的求解上下文：参照点、正交与网格。 */
  readonly pointContext: Omit<CadPointContext, 'snapped'>
  readonly snapEnabled: boolean
  /** 对象捕捉的屏幕半径（CSS 像素）。 */
  readonly snapRadius: number
}

/**
 * 求解当前指示点。
 *
 * @remarks
 * **存屏幕位置而不是世界坐标。**指针给的本来就是屏幕坐标，先转成世界再存等于把一个会过期的
 * 量当事实来源：凡是不以光标为锚点的视口变化，世界坐标不变而屏幕位置变了，指示就会飘离真实
 * 光标。存屏幕、读时解算则天然免疫。
 *
 * **不由任何手势会话拥有。**框选、平移与命令取点是互斥手势，而指示在三者进行期间都要继续
 * 更新；住进任何一个 session 都会在换手势时需要交接状态。
 *
 * 对象捕捉只在命令**正等待取点**时求解，与 AutoCAD 一致：空闲时算捕捉既没有消费者，又会在
 * 每次指针移动上做无谓的几何计算。栅格吸附则始终生效——`resolveCadPoint` 内部处理。
 *
 * @internal
 */
export function useCadIndicatedPoint(params: CadIndicatedPointParams) {
  const { document, viewport, prompt, pointContext, snapEnabled, snapRadius } = params
  const [pointer, setPointer] = useState<{
    readonly screen: CadCanvasPoint
    readonly pointerType: string
  } | null>(null)

  const indicated = useMemo<CadIndicatedPoint | null>(() => {
    if (!pointer) return null
    const raw = cadScreenToWorld(viewport, pointer.screen)
    // 捕捉半径按屏幕像素给出、除以缩放换成世界单位：视图缩小时同样的屏幕半径必须覆盖更大的
    // 世界范围，否则放远了就再也捕不到。
    const snap = snapEnabled && prompt?.accepts.includes('point')
      ? findCadSnap(document, raw, snapRadius / viewport.zoom)
      : null
    return {
      screen: pointer.screen,
      pointerType: pointer.pointerType,
      raw,
      world: resolveCadPoint(raw, 'pointer', { ...pointContext, snapped: snap?.point }),
      snap,
    }
  }, [document, pointContext, pointer, prompt, snapEnabled, snapRadius, viewport])

  return {
    indicated,
    /** 图面上报指针的屏幕位置；指针离开时传 `null`。 */
    setPointerScreen: useCallback((point: CadCanvasPoint | null, pointerType: string) => {
      setPointer(point ? { screen: point, pointerType } : null)
    }, []),
  }
}
