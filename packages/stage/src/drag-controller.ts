import type { NodeStyle } from '@compose-ui/core'
import type { ReactNode } from 'react'
import type { StagePoint } from './geometry'

/**
 * ComponentPalette 可创建的根级 Frame 预设。
 *
 * @public
 */
export interface StageFramePreset {
  /** 一个 Palette 实例内唯一且稳定的预设 ID。 */
  readonly id: string
  /** Palette 显示名称。 */
  readonly label: string
  /** 新建文档节点使用的默认名称。 */
  readonly name: string
  /** 可选宿主图标。 */
  readonly icon?: ReactNode
  /** 新建 Frame 的世界尺寸。 */
  readonly defaultSize: {
    readonly width: number
    readonly height: number
  }
  /** 为每个新 Frame 创建独立的通用 style。 */
  readonly createDefaultStyle: () => NodeStyle
}

/**
 * 当前 Palette Pointer 会话快照。
 *
 * @public
 */
export interface StageDragState {
  /** 当前是否存在 Pointer 或键盘新增意图。 */
  readonly active: boolean
  /** 当前 Component type；Frame 会话为 null。 */
  readonly componentType: string | null
  /** 当前 Frame preset；Component 会话为 null。 */
  readonly framePreset: StageFramePreset | null
  /** 最新 client 坐标；键盘新增时为 null。 */
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
  /**
   * 处理 Frame preset 的 Pointer drop 或键盘新增。
   *
   * @param preset - 当前 Frame preset。
   * @param clientPoint - Pointer client 坐标；null 表示键盘新增。
   * @returns 是否消费该会话。
   */
  dropFrame?(preset: StageFramePreset, clientPoint: StagePoint | null): boolean
}

/**
 * 一个编辑器实例内 Palette 与 Stage 共享的拖入控制器。
 *
 * @public
 */
export interface StageDragController {
  /** 读取当前会话快照。 */
  getState(): StageDragState
  /** 订阅会话变化。 */
  subscribe(listener: () => void): () => void
  /** 注册一个 Stage drop 接收器。 */
  registerTarget(target: StageDropTarget): () => void
  /** 开始 Component Pointer 拖入。 */
  start(componentType: string, clientPoint: StagePoint): void
  /** 开始 Frame Pointer 拖入。 */
  startFrame(preset: StageFramePreset, clientPoint: StagePoint): void
  /** 更新活动 Pointer client 坐标。 */
  move(clientPoint: StagePoint): void
  /** 完成活动 Pointer 会话。 */
  end(clientPoint: StagePoint): void
  /** 取消活动会话。 */
  cancel(): void
  /** 通过键盘新增 Component。 */
  add(componentType: string): void
  /** 通过键盘新增根级 Frame。 */
  addFrame(preset: StageFramePreset): void
}

const idleState: StageDragState = {
  active: false,
  componentType: null,
  framePreset: null,
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
    const framePreset = state.framePreset
    state = idleState
    notify()
    if (framePreset) {
      for (const target of targets) {
        if (target.dropFrame?.(framePreset, clientPoint)) return
      }
      return
    }
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
      state = { active: true, componentType, framePreset: null, clientPoint }
      notify()
    },
    startFrame(framePreset, clientPoint) {
      state = { active: true, componentType: null, framePreset, clientPoint }
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
      state = { active: true, componentType, framePreset: null, clientPoint: null }
      finish(null)
    },
    addFrame(framePreset) {
      state = { active: true, componentType: null, framePreset, clientPoint: null }
      finish(null)
    },
  }
}
