import { useEffect, useRef } from 'react'

/**
 * 预览播放共用的 rAF 循环：`active` 为 true 时逐帧回调经过的毫秒数，false 或卸载时取消。
 *
 * @remarks
 * 预览对话框的手动播放与 `ComposePreview` 的脚本驱动播放共用这一份生命周期管理，
 * 避免两处各写一遍 rAF 与清理。首帧的 delta 为 0（没有上一帧可差分）。
 * 循环自身不判断何时停止：消费方通过把 `active` 置 false 停止（如 play-once 播完）。
 */
export function useAnimationFrameLoop(
  active: boolean,
  onFrame: (deltaMs: number) => void,
): void {
  const callback = useRef(onFrame)
  useEffect(() => {
    callback.current = onFrame
  })
  useEffect(() => {
    if (!active) return
    let frame = 0
    let last: number | null = null
    const tick = (now: number) => {
      const delta = last === null ? 0 : now - last
      last = now
      callback.current(delta)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active])
}
