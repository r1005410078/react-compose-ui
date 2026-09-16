import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComposeRendererProps } from '@compose-ui/component-registry'
import { createComposeChartInstance, type ComposeChartInstance } from './echarts-runtime'
import { composeChartOption, resolveComposeChartModel } from './model'

/**
 * 图表 Renderer。
 *
 * @remarks
 * 尺寸跟随**自身盒子**而不是窗口：画布缩放、Auto Layout 与属性面板改尺寸都会改变这个盒子
 * 而窗口一动不动，只监听 `window.resize` 的症状是图表画在旧尺寸上。
 *
 * 实例住在 ref 里、只建一次：`init` 对同一个元素调用第二次会警告并交回另一个实例，两份实例
 * 画在同一块画布上，屏幕上是两张图叠着。`ready` 是一个真的 state 而不是只读 ref——写 option
 * 的那个 effect 要在实例建好之后重跑一次，而 ref 的改变不触发重渲染。
 *
 * @internal
 */
export function ChartRenderer({ props }: ComposeRendererProps) {
  const host = useRef<HTMLDivElement>(null)
  const chart = useRef<ComposeChartInstance | null>(null)
  const [ready, setReady] = useState(false)
  const model = useMemo(() => resolveComposeChartModel(props), [props])

  useEffect(() => {
    const element = host.current
    if (!element) return
    const instance = createComposeChartInstance(element)
    chart.current = instance
    setReady(true)
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(element)
    return () => {
      observer.disconnect()
      instance.dispose()
      chart.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    chart.current?.setOption(composeChartOption(model))
  }, [model, ready])

  return (
    <div
      aria-label={model.title.length > 0 ? model.title : undefined}
      className="compose-chart"
      data-chart-kind={model.kind}
      data-testid="compose-material-chart"
      ref={host}
      role="img"
    />
  )
}
