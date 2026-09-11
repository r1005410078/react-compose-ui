import type { CSSProperties } from 'react'
import { ComposePreview } from '../compose-preview'
import { ComposePageHost } from '../page-host'
import type { ComposePreviewProps } from '../compose-preview'
import { defaultFitForTargetKind } from '../preview-dialog/screen-size'
import type { ComposePreviewSurfaceValue } from './use-preview-surface'
import './styles.css'

/** ComposePreviewSurface 属性。 @internal */
export interface ComposePreviewSurfaceProps extends Pick<ComposePreviewProps,
  | 'assetResolver'
  | 'layoutRuntime'
  | 'layoutSnapshot'
  | 'pageLoader'
  | 'registry'
  | 'scriptModuleLoader'
  | 'scriptScope'> {
  readonly value: ComposePreviewSurfaceValue
  /** 画板上叠加的 chrome（拖手柄、尺寸胶囊等）；Surface 自己不画任何控件。 */
  readonly artboardOverlay?: React.ReactNode
  readonly artboardTestId?: string
}

/**
 * 被预览的那块屏，以及承载它的台面。
 *
 * @remarks
 * 模态与整屏两个形态都由本组件画内容，因此「同一份输入两个形态画出同样的东西」是构造上
 * 成立的，而不是靠两处各自维护。本组件**不画任何 chrome**。
 *
 * @internal
 */
export function ComposePreviewSurface({
  artboardOverlay,
  artboardTestId,
  assetResolver,
  layoutRuntime,
  layoutSnapshot,
  pageLoader,
  registry,
  scriptModuleLoader,
  scriptScope,
  value,
}: ComposePreviewSurfaceProps) {
  const { content, screenSize, viewport } = value
  const fit = defaultFitForTargetKind(value.targetKind)
  // 动画播放期间走布局 Runtime 之外的路径：采样每帧换文档，预解算的快照对不上。
  const runtime = value.animation ? undefined : layoutRuntime
  const snapshot = value.animation ? undefined : layoutSnapshot

  return (
    <div
      className="compose-preview-surface__artboard"
      data-testid={artboardTestId}
      style={{
        left: viewport.offset.x,
        top: viewport.offset.y,
        width: screenSize.width * viewport.zoom,
        height: screenSize.height * viewport.zoom,
      }}
    >
      <div
        className="compose-preview-surface__screen"
        style={{
          width: screenSize.width,
          height: screenSize.height,
          transform: `scale(${viewport.zoom})`,
        } as CSSProperties}
      >
        {content.pageMode && content.navigation && pageLoader
          ? (
              <ComposePageHost
                animationTimeMs={content.animationTimeMs}
                assetResolver={assetResolver}
                fit={fit}
                frameId={content.frameId}
                layoutRuntime={runtime}
                layoutSnapshot={snapshot}
                navigation={content.navigation}
                onPageChange={content.onPageChange}
                livePage={content.livePage}
                pageLoader={pageLoader}
                registry={registry}
                scriptModuleLoader={scriptModuleLoader}
              />
            )
          : (
              <ComposePreview
                animationTimeMs={content.animationTimeMs}
                assetResolver={assetResolver}
                document={content.document}
                fit={fit}
                page={content.page}
                layoutRuntime={runtime}
                layoutSnapshot={snapshot}
                pageLoader={pageLoader}
                registry={registry}
                scriptModuleLoader={scriptModuleLoader}
                scriptScope={scriptScope}
                frameId={content.frameId}
              />
            )}
      </div>
      {artboardOverlay}
    </div>
  )
}
