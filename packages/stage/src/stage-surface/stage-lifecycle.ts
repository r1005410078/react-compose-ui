import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { createComposeRendererMeasurementAdapter } from '@compose-ui/component-registry'
import type { ComposeRendererMeasurementAdapter } from '@compose-ui/component-registry'
import type { StageInteractionController } from '@compose-ui/stage-engine'
import type { ComposeStageProps } from '../types'

/**
 * 组件真正卸载时释放私有 Controller。
 *
 * @remarks
 * 不能在 effect 的 cleanup 里直接 dispose：StrictMode 会重放 setup/cleanup，那次 cleanup
 * 不是最终卸载。用 generation 判定——若微任务执行时 generation 已被后续 setup 提升，说明
 * 这只是一次重放，取消释放。
 */
export function useFinalControllerDisposal(controller: StageInteractionController) {
  const effectGeneration = useRef(0)
  useEffect(() => {
    effectGeneration.current += 1
    const mountedGeneration = effectGeneration.current
    return () => {
      // StrictMode 的 effect 重放不是最终卸载；后续 setup 会提升 generation 并取消本次释放。
      queueMicrotask(() => {
        if (effectGeneration.current === mountedGeneration) controller.dispose()
      })
    }
  }, [controller])
}

/**
 * 创建并维护 Renderer 测量适配器。
 *
 * @remarks
 * 释放同样要防 StrictMode 重放，判据与 Controller 一致，但按 adapter 分别记账——同一次
 * 渲染里 adapter 可能因端口变化而更换，两代的释放不能互相取消。
 */
export function useComposeStageMeasurement({
  document,
  scriptScope,
  services,
}: ComposeStageProps) {
  // 按字段消费端口而不是整个 services 对象：adapter 只应在它实际使用的那几个端口变化时
  // 重建。以对象引用作依赖会让宿主每次重新构造 services 都重建 adapter 并丢弃测量缓存。
  const { assetResolver, layoutRuntime, registry } = services
  const adapter = useMemo(() => createComposeRendererMeasurementAdapter({
    registry,
    assetResolver,
    scriptScope,
  }), [assetResolver, registry, scriptScope])
  const disposalGenerations = useRef(new WeakMap<ComposeRendererMeasurementAdapter, number>())

  useLayoutEffect(() => adapter.updateDocument(document), [adapter, document])
  useLayoutEffect(() => {
    if (!layoutRuntime) return
    layoutRuntime.setMeasurementPort(adapter)
    return () => layoutRuntime.setMeasurementPort(undefined)
  }, [adapter, layoutRuntime])
  useEffect(() => {
    const generations = disposalGenerations.current
    const generation = (generations.get(adapter) ?? 0) + 1
    generations.set(adapter, generation)
    return () => queueMicrotask(() => {
      if (generations.get(adapter) !== generation) return
      adapter.dispose()
      generations.delete(adapter)
    })
  }, [adapter])
  return adapter
}
