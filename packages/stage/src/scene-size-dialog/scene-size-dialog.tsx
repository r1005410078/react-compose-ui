import { useId, useState } from 'react'
import {
  COMPOSE_SCENE_SIZE_PRESETS,
  findComposeSceneSizePreset,
  formatComposeSceneSizePresetLabel,
  type ComposeSize,
} from '@compose-ui/core'
import {
  ComposeButton,
  ComposeDialog,
  ComposeDialogBackdrop,
  ComposeDialogContent,
  ComposeDialogDescription,
  ComposeDialogFooter,
  ComposeDialogHeader,
  ComposeDialogPortal,
  ComposeDialogTitle,
  ComposeDialogViewport,
  ComposeInput,
} from '@compose-ui/components'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { getStageMessages } from '../stage-i18n'

/** {@link ComposeSceneSizeDialog} 的受控输入。 @internal */
export interface ComposeSceneSizeDialogProps {
  /** 场景名称；只用于标题与说明文案。 */
  readonly sceneName: string
  /**
   * 该场景当前的 `Frame.size`；草稿以它为初值。
   *
   * @remarks
   * 组件只在挂载时读取一次。调用方每次打开都重新挂载（关闭即卸载），因此"每次打开回到
   * 当前尺寸"由生命周期保证，而不是靠 Effect 把 props 同步回 state。
   */
  readonly size: ComposeSize
  /** 请求关闭；取消、Esc 与点击遮罩都走这里，且都不写文档。 */
  readonly onClose: () => void
  /** 确认提交新尺寸；与当前尺寸相同时不会被调用。 */
  readonly onSubmit: (size: ComposeSize) => void
}

/**
 * 解析宽高草稿。
 *
 * @returns 两个轴都是正有限数时返回尺寸，否则返回 `null`（确认入口据此禁用）。
 */
function parseDraft(width: string, height: string): ComposeSize | null {
  const parsedWidth = Number(width.trim())
  const parsedHeight = Number(height.trim())
  if (width.trim() === '' || height.trim() === '') return null
  if (!Number.isFinite(parsedWidth) || parsedWidth <= 0) return null
  if (!Number.isFinite(parsedHeight) || parsedHeight <= 0) return null
  return { width: parsedWidth, height: parsedHeight }
}

/**
 * 场景尺寸弹框：常见分辨率预设 + 自定义宽高。
 *
 * @remarks
 * 预设与自定义输入共用同一份草稿——选中预设只是把两个数字填进输入框，用户可以接着微调。
 * 分成两份状态的话，「先选 1920×1080 再把宽改成 1900」就会出现两个互相矛盾的待提交值。
 *
 * 弹框只产出一个尺寸，命令由 Stage 派发：它与 Inspector 几何分组共用
 * `entity.frame.size.set`，因此撤销一步即回到原尺寸。
 * @internal
 */
export function ComposeSceneSizeDialog({
  sceneName,
  size,
  onClose,
  onSubmit,
}: ComposeSceneSizeDialogProps) {
  const i18n = useComposeI18nContext()
  const messages = getStageMessages(i18n?.locale ?? 'zh-CN', i18n?.formatMessage)
  const [width, setWidth] = useState(() => String(size.width))
  const [height, setHeight] = useState(() => String(size.height))
  const widthId = useId()
  const heightId = useId()
  const draft = parseDraft(width, height)
  const activePreset = draft ? findComposeSceneSizePreset(draft) : null

  const submit = () => {
    if (!draft) return
    // 尺寸没变时只关闭：派发出去也会被 core 判成 noop，但那会在操作日志里留下一条空事务。
    if (draft.width !== size.width || draft.height !== size.height) onSubmit(draft)
    onClose()
  }

  return (
    <ComposeDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ComposeDialogPortal>
        <ComposeDialogBackdrop />
        <ComposeDialogViewport>
          <ComposeDialogContent data-testid="stage-scene-size-dialog">
            <form
              className="compose-scene-size-dialog"
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <ComposeDialogHeader>
                <ComposeDialogTitle>{messages.sceneSizeTitle}</ComposeDialogTitle>
                <ComposeDialogDescription>
                  {messages.sceneSizeDescription(sceneName)}
                </ComposeDialogDescription>
              </ComposeDialogHeader>

              <fieldset className="compose-scene-size-dialog__group">
                <legend className="compose-scene-size-dialog__legend">
                  {messages.sceneSizeCommon}
                </legend>
                <div className="compose-scene-size-dialog__presets">
                  {COMPOSE_SCENE_SIZE_PRESETS.map((preset) => (
                    <button
                      aria-pressed={activePreset?.id === preset.id}
                      className="compose-scene-size-dialog__preset"
                      data-testid={`stage-scene-size-preset-${preset.id}`}
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setWidth(String(preset.size.width))
                        setHeight(String(preset.size.height))
                      }}
                    >
                      {formatComposeSceneSizePresetLabel(preset)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="compose-scene-size-dialog__group">
                <legend className="compose-scene-size-dialog__legend">
                  {messages.sceneSizeCustom}
                </legend>
                <div className="compose-scene-size-dialog__fields">
                  <label className="compose-scene-size-dialog__field" htmlFor={widthId}>
                    <span>{messages.sceneSizeWidth}</span>
                    <ComposeInput
                      data-testid="stage-scene-size-width"
                      id={widthId}
                      inputMode="numeric"
                      min={1}
                      size="sm"
                      step={1}
                      type="number"
                      value={width}
                      onChange={(event) => setWidth(event.target.value)}
                    />
                  </label>
                  <label className="compose-scene-size-dialog__field" htmlFor={heightId}>
                    <span>{messages.sceneSizeHeight}</span>
                    <ComposeInput
                      data-testid="stage-scene-size-height"
                      id={heightId}
                      inputMode="numeric"
                      min={1}
                      size="sm"
                      step={1}
                      type="number"
                      value={height}
                      onChange={(event) => setHeight(event.target.value)}
                    />
                  </label>
                </div>
              </fieldset>

              <ComposeDialogFooter>
                <ComposeButton type="button" variant="outline" onClick={onClose}>
                  {messages.cancel}
                </ComposeButton>
                <ComposeButton
                  data-testid="stage-scene-size-confirm"
                  disabled={draft === null}
                  type="submit"
                >
                  {messages.confirm}
                </ComposeButton>
              </ComposeDialogFooter>
            </form>
          </ComposeDialogContent>
        </ComposeDialogViewport>
      </ComposeDialogPortal>
    </ComposeDialog>
  )
}
