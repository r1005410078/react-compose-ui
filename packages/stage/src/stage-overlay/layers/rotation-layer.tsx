import { worldToScreen } from '@compose-ui/stage-engine'
import type { StageOverlayContext } from '../overlay-types'

/**
 * Godot 风格旋转拉线：中心枢轴 + 指向指针的拉杆 + 末端圆点。
 *
 * @remarks
 * 拉线只在手势进行中绘制（`rotationPreview`）；空闲时最多只显示中心点，
 * 不依赖固定手柄位置——任意点按下即可开始旋转。
 */
function RotationRubberBand({
  centerX,
  centerY,
  pointerX,
  pointerY,
  active,
  angleDegrees = 0,
  snapped = false,
}: {
  readonly centerX: number
  readonly centerY: number
  readonly pointerX: number
  readonly pointerY: number
  readonly active: boolean
  readonly angleDegrees?: number
  readonly snapped?: boolean
}) {
  // 拉杆不画进枢轴圆心，避免压住中心标记。
  const dx = pointerX - centerX
  const dy = pointerY - centerY
  const length = Math.hypot(dx, dy)
  const unitX = length > 1 ? dx / length : 0
  const unitY = length > 1 ? dy / length : -1
  const stemStartX = centerX + unitX * 5
  const stemStartY = centerY + unitY * 5
  const tipInset = active ? 0 : 7
  const stemEndX = pointerX - unitX * tipInset
  const stemEndY = pointerY - unitY * tipInset
  // 角度标注放在拉线中点偏外，吸附态用更高对比。
  const labelX = (centerX + pointerX) / 2 - unitY * 14
  const labelY = (centerY + pointerY) / 2 + unitX * 14
  const angleLabel = `${Math.round(angleDegrees * 10) / 10}°`

  return (
    <g
      className={`compose-stage__rotation-gizmo${snapped ? ' is-snapped' : ''}`}
      data-testid="stage-rotation-gizmo"
    >
      {active ? (
        <line
          className="compose-stage__rotation-stem"
          x1={stemStartX}
          x2={stemEndX}
          y1={stemStartY}
          y2={stemEndY}
        />
      ) : null}
      {/* 中心枢轴：外环 + 实心点 */}
      <circle
        className="compose-stage__rotation-center-ring"
        cx={centerX}
        cy={centerY}
        data-testid="stage-rotation-center"
        r="4.5"
      />
      <circle
        className="compose-stage__rotation-center-dot"
        cx={centerX}
        cy={centerY}
        r="1.75"
      />
      {active ? (
        <circle
          className="compose-stage__handle compose-stage__rotation"
          cx={pointerX}
          cy={pointerY}
          data-testid="stage-rotation-handle"
          r="5.5"
        />
      ) : null}
      {active ? (
        <g
          className="compose-stage__rotation-angle"
          data-testid="stage-rotation-angle"
          transform={`translate(${labelX} ${labelY})`}
        >
          <rect height="18" rx="4" width={Math.max(36, angleLabel.length * 7 + 12)} x="-18" y="-9" />
          <text dominantBaseline="middle" textAnchor="middle" x="0" y="0">{angleLabel}</text>
        </g>
      ) : null}
    </g>
  )
}

/** 渲染 engine snapshot 的 SVG 编辑覆盖层，不持有手势状态。 */
/**
 * Godot 旋转层。
 *
 * @remarks
 * 空闲时只在选区中心显示枢轴，按下后拉线跟随鼠标。中心取自选区外接盒；两点图形没有外接盒，
 * 改取两端点的中点。
 */
export function RotationContribution({
  lineSelection = null,
  rotatable,
  rotationPreview = null,
  screenBounds,
  textEditing,
  tool,
  viewport,
}: StageOverlayContext) {
  const lineStartScreen = lineSelection ? worldToScreen(lineSelection.start, viewport) : null
  const lineEndScreen = lineSelection ? worldToScreen(lineSelection.end, viewport) : null
  const rotationPreviewScreen = rotationPreview
    ? {
        center: worldToScreen(rotationPreview.center, viewport),
        pointer: worldToScreen(rotationPreview.pointer, viewport),
        active: true as const,
      }
    : rotatable && tool === 'rotate' && !textEditing && screenBounds
      ? {
          center: {
            x: screenBounds.x + screenBounds.width / 2,
            y: screenBounds.y + screenBounds.height / 2,
          },
          pointer: {
            x: screenBounds.x + screenBounds.width / 2,
            y: screenBounds.y + screenBounds.height / 2,
          },
          active: false as const,
        }
      : rotatable && tool === 'rotate' && !textEditing && lineStartScreen && lineEndScreen
        ? {
            center: {
              x: (lineStartScreen.x + lineEndScreen.x) / 2,
              y: (lineStartScreen.y + lineEndScreen.y) / 2,
            },
            pointer: {
              x: (lineStartScreen.x + lineEndScreen.x) / 2,
              y: (lineStartScreen.y + lineEndScreen.y) / 2,
            },
            active: false as const,
          }
        : null
  if (!rotationPreviewScreen) return null
  return (
    <RotationRubberBand
      active={rotationPreviewScreen.active}
      angleDegrees={rotationPreview?.angleDegrees ?? 0}
      centerX={rotationPreviewScreen.center.x}
      centerY={rotationPreviewScreen.center.y}
      pointerX={rotationPreviewScreen.pointer.x}
      pointerY={rotationPreviewScreen.pointer.y}
      snapped={rotationPreview?.snapped ?? false}
    />
  )
}
