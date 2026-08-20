import { useMemo } from 'react'
import type { ComponentType } from 'react'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_SCENE_SIZE_PRESETS,
  createComposeBatchCommand,
  findComposeSceneSizePreset,
  formatComposeSceneSizePresetLabel,
  getComposeFrame,
  getComposeFrameGuides,
} from '@compose-ui/core'
import type { EditorCommand } from '@compose-ui/core'
import type { ComposeComponentInspectorProps } from '@compose-ui/component-registry'
import * as v from 'valibot'
import type { InspectorIdFactory } from '../material-inspector-kit/renderer-inspectors'
import './styles.css'

/** 当前尺寸不匹配任何预设时下拉停在这一项；它不代表一个可提交的值。 */
const CUSTOM_PRESET_VALUE = 'custom'

/**
 * 常见桌面输出分辨率的 value 列表。
 *
 * @remarks
 * 预设本身住在 core：画布场景标签的尺寸胶囊与本 Inspector 是同一组分辨率的两个入口，
 * 各写一份必然漂移。这里只是把它摊平成 Valibot picklist 需要的字符串数组。
 */
const PRESET_VALUES = COMPOSE_SCENE_SIZE_PRESETS.map(({ id }) => id)

type FrameInspectorValue = { readonly sizePreset: string }

/**
 * 创建 Frame（界面上的「场景」）Component Inspector。
 *
 * @remarks
 * 场景是普通容器，因此这里只承载容器属性之外、真正属于场景的两件事：常见尺寸预设，
 * 以及该 Frame 自己的辅助线。尺寸数值由几何分组的唯一尺寸字段编辑，背景由 Appearance
 * 分组编辑——场景不该有第二套属性面板。
 *
 * 辅助线归属 Frame，因此清空动作也必须按当前 Frame 收敛：早先放在画布设置弹层里的那个
 * 入口硬编码第一个根 Frame，多场景下清的是错的那块。
 * @internal
 */
export function createFrameInspector(
  idFactory: InspectorIdFactory,
): ComponentType<ComposeComponentInspectorProps> {
  return function FrameInspector({ entity, dispatch, readOnly }) {
    const i18n = useComposeI18nContext()
    const zh = (i18n?.locale ?? 'zh-CN') === 'zh-CN'
    const frame = getComposeFrame(entity)
    const guides = getComposeFrameGuides(entity)
    const size = frame?.size
    const preset = size ? findComposeSceneSizePreset(size) : null

    const schema = useMemo(() => v.object({
      sizePreset: v.pipe(
        v.picklist([CUSTOM_PRESET_VALUE, ...PRESET_VALUES]),
        v.title(zh ? '常见尺寸' : 'Common size'),
        v.metadata({
          propertyPanel: {
            optionLabels: {
              [CUSTOM_PRESET_VALUE]: zh ? '自定义尺寸' : 'Custom size',
              ...Object.fromEntries(
                COMPOSE_SCENE_SIZE_PRESETS.map((item) => [
                  item.id,
                  formatComposeSceneSizePresetLabel(item),
                ]),
              ),
            },
          },
        }),
      ),
    }), [zh])

    const value = useMemo((): FrameInspectorValue => ({
      sizePreset: preset?.id ?? CUSTOM_PRESET_VALUE,
    }), [preset])

    const clearGuides = () => {
      const deletes: EditorCommand[] = guides.map((guide) => ({
        id: idFactory(),
        type: BUILTIN_COMMAND_TYPES.deleteFrameGuide,
        payload: { frameId: entity.id, guideId: guide.id },
      }))
      if (deletes.length === 0) return
      dispatch(deletes.length === 1
        ? deletes[0]!
        : createComposeBatchCommand({
            id: idFactory(),
            commands: deletes,
            meta: {
              label: zh ? '清空场景辅助线' : 'Clear scene guides',
              source: 'inspector',
              targetIds: [entity.id],
            },
          }))
    }

    return (
      <>
        <ComposePropertyPanel
          aria-label={zh ? '场景属性' : 'Scene properties'}
          readOnly={readOnly}
          schema={schema}
          value={value}
          onValueChange={(next) => {
            const nextPreset = COMPOSE_SCENE_SIZE_PRESETS.find(
              (candidate) => candidate.id === (next as FrameInspectorValue).sizePreset,
            )
            // 选到「自定义尺寸」不派发命令：它只表示当前尺寸不匹配任一预设，
            // 真正的自定义值在几何分组里输入。
            if (!nextPreset) return
            if (
              size
              && nextPreset.size.width === size.width
              && nextPreset.size.height === size.height
            ) return
            dispatch({
              id: idFactory(),
              type: BUILTIN_COMMAND_TYPES.setFrameSize,
              payload: {
                entityId: entity.id,
                size: { width: nextPreset.size.width, height: nextPreset.size.height },
              },
              meta: {
                label: zh ? '设置场景尺寸' : 'Set scene size',
                source: 'inspector',
                targetIds: [entity.id],
              },
            })
          }}
        />
        <button
          className="compose-frame-inspector__clear-guides"
          disabled={readOnly || guides.length === 0}
          type="button"
          onClick={clearGuides}
        >
          {zh ? `清空辅助线（${guides.length}）` : `Clear guides (${guides.length})`}
        </button>
      </>
    )
  }
}
