import type { StagePoint } from './geometry'

/**
 * 当前 Palette Pointer 会话快照。
 *
 * @public
 */
export interface StageDragState {
  readonly active: boolean
  readonly componentType: string | null
  readonly clientPoint: StagePoint | null
}

/**
 * Stage 注册的 Palette drop 接收器。
 *
 * @public
 */
export interface StageDropTarget {
  /**
   * 处理 Pointer drop 或键盘新增。
   *
   * @param componentType - registry definition type。
   * @param clientPoint - Pointer client 坐标；null 表示键盘新增。
   * @returns 是否消费该会话。
   */
  drop(componentType: string, clientPoint: StagePoint | null): boolean
}

/**
 * 一个编辑器实例内 Palette 与 Stage 共享的拖入控制器。
 *
 * @public
 */
export interface StageDragController {
  getState(): StageDragState
  subscribe(listener: () => void): () => void
  registerTarget(target: StageDropTarget): () => void
  start(componentType: string, clientPoint: StagePoint): void
  move(clientPoint: StagePoint): void
  end(clientPoint: StagePoint): void
  cancel(): void
  add(componentType: string): void
}

const idleState: StageDragState = {
  active: false,
  componentType: null,
  clientPoint: null,
}

/**
 * 创建没有模块级状态或跨实例监听的 Palette/Stage 控制器。
 *
 * @public
 */
export function createStageDragController(): StageDragController {
  let state = idleState
  const listeners = new Set<() => void>()
  const targets = new Set<StageDropTarget>()
  const notify = () => listeners.forEach((listener) => listener())
  const finish = (clientPoint: StagePoint | null) => {
    const componentType = state.componentType
    state = idleState
    notify()
    if (!componentType) return
    for (const target of targets) {
      if (target.drop(componentType, clientPoint)) return
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    registerTarget(target) {
      targets.add(target)
      return () => targets.delete(target)
    },
    start(componentType, clientPoint) {
      state = { active: true, componentType, clientPoint }
      notify()
    },
    move(clientPoint) {
      if (!state.active) return
      state = { ...state, clientPoint }
      notify()
    },
    end(clientPoint) {
      if (!state.active) return
      finish(clientPoint)
    },
    cancel() {
      if (!state.active) return
      state = idleState
      notify()
    },
    add(componentType) {
      state = { active: true, componentType, clientPoint: null }
      finish(null)
    },
  }
}
