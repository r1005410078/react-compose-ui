import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { findComposeAnimationTrack } from '@compose-ui/animation'
import type { ComposeAnimationTrack } from '@compose-ui/animation'
import { getComposeLayoutItem } from '@compose-ui/core'
import type { ComposeDocument, ComposeLayoutSnapshot, EditorCommand } from '@compose-ui/core'
import type { StageEditablePath } from '@compose-ui/stage-engine'
import type { ComposeStageEditablePathChange } from '@compose-ui/stage'
import {
  applyMotionPathDraftToTrack,
  buildMotionPathEditablePath,
  motionPathCommandForDraft,
  motionPathDraftForChange,
  motionPathDraftIsNoop,
  motionPathToggleCommand,
} from './motion-path-adapter'
import type { MotionPathOrigin } from './motion-path-adapter'

const OFFSET_PATH = ['LayoutItem', 'offset'] as const

/** `useMotionPath` 的接入端口。 */
export interface MotionPathOptions {
  /** 动画模式活动且存在动画时为 true；false 时立即清除路径。 */
  readonly enabled: boolean
  /** 基础文档：轨道与关键帧的事实来源。 */
  readonly document: ComposeDocument | undefined
  /** 播放头时刻的采样文档；与布局快照配对推导世界坐标原点。 */
  readonly displayDocument: ComposeDocument | undefined
  readonly animationId: string | null
  /** 单选的普通 Entity；多选或实例内部选择传 null。 */
  readonly entityId: string | null
  /** 采样文档的布局快照；未就绪时不显示路径。 */
  readonly layoutSnapshot: ComposeLayoutSnapshot | null
  readonly dispatch?: (command: EditorCommand) => unknown
  readonly idFactory: () => string
}

/** 运动路径会话向 Stage props 暴露的受控接口。 */
export interface MotionPathPort {
  readonly editablePath: StageEditablePath | null
  readonly activeVertexId: string | null
  readonly onEditablePathChange: (change: ComposeStageEditablePathChange) => void
  readonly onEditablePathVertexToggle: (vertexId: string) => void
}

/**
 * 选中 Entity 的运动路径会话：几何派生、拖动预览与命令派发。
 *
 * @remarks
 * `move` 阶段只把草稿套在本地预览轨道上重建几何，不派发命令；`end` 阶段与轨道现状
 * 不同才派发一条带 `mergeKey` 的命令——一次拖拽在撤销栈里只有一条记录，原地点击
 * 不产生事务。世界坐标原点从采样文档的布局快照反推（box 角点 − 采样 offset + 半尺寸），
 * 路径从物体中心出发并跟随父级当前位置；父级旋转暂不支持。
 */
export function useMotionPath(options: MotionPathOptions): MotionPathPort {
  const {
    animationId,
    dispatch,
    displayDocument,
    document,
    enabled,
    entityId,
    idFactory,
    layoutSnapshot,
  } = options

  const [previewTrack, setPreviewTrack] = useState<ComposeAnimationTrack | null>(null)
  const [activeVertexId, setActiveVertexId] = useState<string | null>(null)

  // 会话身份变化（换实体、换动画、退出模式）时丢弃预览与活动顶点。
  // 渲染期 prev-adjust 写法：本仓库禁止在 effect 里同步 setState。
  const sessionKey = enabled && entityId && animationId ? `${animationId}:${entityId}` : null
  const [previousSessionKey, setPreviousSessionKey] = useState(sessionKey)
  if (previousSessionKey !== sessionKey) {
    setPreviousSessionKey(sessionKey)
    setPreviewTrack(null)
    setActiveVertexId(null)
  }

  const entity = document && entityId ? document.entities[entityId] : undefined
  const baseTrack = entity && animationId
    ? findComposeAnimationTrack(entity, animationId, OFFSET_PATH)
    : null

  const origin = useMemo<MotionPathOrigin | null>(() => {
    if (!entityId || !displayDocument || !layoutSnapshot) return null
    const sampled = displayDocument.entities[entityId]
    const box = layoutSnapshot.boxes[entityId]
    if (!sampled || !box) return null
    const offset = getComposeLayoutItem(sampled).offset
    // 原点加半宽半高：路径穿过物体中心而不是左上角，顶点/切线的世界↔offset 换算
    // 经同一 origin 折返，编辑语义不变。尺寸取当前采样时刻的盒子（尺寸被动画时路径
    // 锚随当前尺寸的中心走）。
    return {
      x: box.x - offset.x + box.width / 2,
      y: box.y - offset.y + box.height / 2,
    }
  }, [displayDocument, entityId, layoutSnapshot])

  const latest = useRef({ animationId, baseTrack, dispatch, entityId, idFactory, origin })
  useEffect(() => {
    latest.current = { animationId, baseTrack, dispatch, entityId, idFactory, origin }
  })

  const editablePath = useMemo(() => {
    if (!sessionKey || !entityId || !origin) return null
    const track = previewTrack ?? baseTrack
    return track ? buildMotionPathEditablePath(entityId, track, origin) : null
  }, [baseTrack, entityId, origin, previewTrack, sessionKey])

  const onEditablePathChange = useCallback((change: ComposeStageEditablePathChange) => {
    const current = latest.current
    if (!current.baseTrack || !current.origin || !current.animationId || !current.entityId) return
    if (change.phase === 'start') {
      setActiveVertexId(change.vertexId)
      return
    }
    if (change.phase === 'cancel') {
      setPreviewTrack(null)
      return
    }
    const draft = motionPathDraftForChange(current.baseTrack, change, current.origin)
    if (!draft) return
    if (change.phase === 'move') {
      setPreviewTrack(applyMotionPathDraftToTrack(current.baseTrack, draft))
      return
    }
    setPreviewTrack(null)
    if (motionPathDraftIsNoop(current.baseTrack, draft)) return
    current.dispatch?.(motionPathCommandForDraft(draft, {
      animationId: current.animationId,
      entityId: current.entityId,
      idFactory: current.idFactory,
    }))
  }, [])

  const onEditablePathVertexToggle = useCallback((vertexId: string) => {
    const current = latest.current
    if (!current.baseTrack || !current.animationId || !current.entityId) return
    const command = motionPathToggleCommand(current.baseTrack, vertexId, {
      animationId: current.animationId,
      entityId: current.entityId,
      idFactory: current.idFactory,
    })
    if (command) current.dispatch?.(command)
  }, [])

  return { editablePath, activeVertexId, onEditablePathChange, onEditablePathVertexToggle }
}
