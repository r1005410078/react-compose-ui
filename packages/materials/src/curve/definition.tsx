import type {
  ComposeEntityPreset,
  ComposeRendererPropContract,
  ComposeRendererDefinition,
} from '@compose-ui/component-registry'
import * as v from 'valibot'
import {
  COMPOSE_JUNCTION_PORT_ID,
  composeJunctionGeometry,
  composeJunctionSize,
} from '@compose-ui/core'
import type { ComposeAppearance, ComposeCurve, JsonObject } from '@compose-ui/core'
import type { ReactNode } from 'react'
import type { ComposeBasicMaterialOptions, ComposeCurveMaterialOptions } from '../types'
import {
  ComposeArrowMaterialIcon,
  ComposeCircleMaterialIcon,
  ComposeLineMaterialIcon,
  ComposeRectMaterialIcon,
} from '../material-icons'
import { mergeAppearance, mergeJson, rendererPresetComponents } from '../material-preset'
import {
  COMPOSE_WIRE_STROKE_WIDTH,
  composeRectangleGeometry,
  DEFAULT_ARROW_PROPS,
  DEFAULT_CIRCLE_GEOMETRY,
  DEFAULT_CURVE_APPEARANCE,
  DEFAULT_CURVE_GEOMETRY,
  DEFAULT_CURVE_PROPS,
  DEFAULT_CURVE_SIZE,
  DEFAULT_HATCH_APPEARANCE,
  DEFAULT_HATCH_PROPS,
  DEFAULT_JUNCTION_APPEARANCE,
  DEFAULT_JUNCTION_PROPS,
  DEFAULT_WIRE_PROPS,
} from './defaults'
import {
  createCurveRendererInspector,
  createDefaultInspectorId,
  type InspectorIdFactory,
} from '../material-inspector-kit/renderer-inspectors'
import { CURVE_RENDERER_PROP_SCHEMAS } from './props'
import { CurveRenderer } from './renderer'

function valueContract(
  name: keyof typeof CURVE_RENDERER_PROP_SCHEMAS,
  label: string,
): ComposeRendererPropContract {
  return {
    name,
    kind: 'value',
    label,
    category: 'stroke',
    affectsMeasurement: false,
    validate: (value) => v.safeParse(CURVE_RENDERER_PROP_SCHEMAS[name], value).success
      ? true
      : `${label} 与 Curve Prop Contract 不兼容`,
  }
}

/**
 * 曲线的一个起点。
 *
 * @remarks
 * 四个 Preset 的差别只有默认几何与默认描边，Renderer 是同一个——「盒 + 方向」与「坐标」不得
 * 同时存在两种线的表示，用户看不出区别却会得到不同的编辑手感。
 */
function curvePreset(
  id: 'curve' | 'arrow' | 'circle' | 'rect' | 'wire' | 'junction' | 'hatch',
  /**
   * 面板显示名与新建对象的默认名。
   *
   * @remarks
   * 两者是**不同的字段**，因此分开给：显示名是中文（界面其余部分本来就是中文），而默认名写进
   * **文档**，改它会动到既有页面与用户已经命名过的对象。
   */
  fallbackNames: { readonly label: string, readonly name: string },
  fallbackProps: JsonObject,
  geometry: (size: { readonly width: number; readonly height: number }) => ComposeCurve,
  icon: ReactNode,
  paletteHidden: 'toolbar' | 'always' | null,
  options: ComposeBasicMaterialOptions = {},
  extra: {
    readonly fallbackSize?: { readonly width: number; readonly height: number }
    readonly fallbackAppearance?: ComposeAppearance
    /** 额外的 Component；节点靠它带上自己的那一个端口与几何约束。 */
    readonly components?: (size: { readonly width: number; readonly height: number }) => JsonObject
  } = {},
): ComposeEntityPreset {
  const size = options.defaultSize ?? extra.fallbackSize ?? DEFAULT_CURVE_SIZE
  const props = mergeJson(fallbackProps, options.defaultProps)
  const appearance = mergeAppearance(
    extra.fallbackAppearance ?? DEFAULT_CURVE_APPEARANCE,
    options.defaultAppearance,
  )
  return {
    id,
    label: options.label ?? fallbackNames.label,
    defaultName: options.name ?? fallbackNames.name,
    icon,
    ...(paletteHidden ? { paletteHidden } : {}),
    createComponents: () => ({
      ...rendererPresetComponents({ type: 'curve', props, size, appearance }),
      Curve: geometry(size) as unknown as JsonObject,
      ...(extra.components ? extra.components(size) : {}),
    }),
  }
}

/**
 * 创建曲线 Renderer 与它的四个 Preset。
 *
 * @remarks
 * Preset 在 `rendererPresetComponents` 之外补一个 `Curve` 承载几何。
 *
 * 曾经还补一个 `GeometryConstraints` 关掉 resize，理由是「盒缩放该不该等比缩放几何点还没
 * 定」。**现在定了**：盒自由，几何按 `viewBox` 与盒的比例呈现，因此手柄回来，走的是所有
 * Entity 共用的那一条缩放路径。**节点是这条的唯一例外，而理由完全不同**——不是「还没想
 * 清楚」，是它的尺寸由线宽推出、不是作者写下的量，而改它会静默弄坏绑定的落点。
 *
 * `paletteHidden` 分两档。`'toolbar'` 是「工具栏已提供入口」，与物料本身无关：Arrow 与 Circle
 * 各有一条绘图命令，Curve 没有——这一档**按当前工作区的货架**求值，因此页面工作区（默认货架
 * 不含 `CIRCLE`）里圆的瓦片会出现。Wire 是 `'always'`：它有一条自己的理由——从 Palette 拖出来
 * 的导线**没有任何端口绑定**，而那条粗线正在宣称它是主回路，这与谁的货架上有没有按钮无关。
 *
 * @internal
 */
export function createCurveMaterial(
  options: ComposeCurveMaterialOptions = {},
  idFactory: InspectorIdFactory = createDefaultInspectorId,
): {
  renderer: ComposeRendererDefinition
  presets: readonly [
    ComposeEntityPreset,
    ComposeEntityPreset,
    ComposeEntityPreset,
    ComposeEntityPreset,
    ComposeEntityPreset,
    ComposeEntityPreset,
    ComposeEntityPreset,
  ]
} {
  return {
    renderer: {
      type: 'curve',
      label: 'Curve',
      renderer: CurveRenderer,
      propContracts: [
        valueContract('stroke', 'Stroke'),
        valueContract('strokeWidth', 'Stroke width'),
        valueContract('strokeLinecap', 'Line cap'),
        valueContract('strokeDasharray', 'Line style'),
        valueContract('strokeDashoffset', 'Dash offset'),
        valueContract('markerStart', 'Start arrow'),
        valueContract('markerEnd', 'End arrow'),
      ],
      propCategories: [{ id: 'stroke', label: '描边', inspectorDefaultExpanded: true }],
      inspectorPropNames: [
        'stroke',
        'strokeWidth',
        'strokeLinecap',
        'strokeDasharray',
        'strokeDashoffset',
        'markerStart',
        'markerEnd',
      ],
      inspector: createCurveRendererInspector(idFactory),
      /*
       * 整个形状落进一个像素之内的曲线在编辑画布上不建节点：描边不随缩放变细，它画出来只是
       * 一个位置被量化过的点。两轴都要低于阈值才裁——一条 0.5×300 的导线高度轴不到一像素，
       * 宽度轴远不止，照画。一份真实接线图缩到整张图可见时有近两千条这样的小圆与短线。
       */
      minimumLegibleSize: { width: 1, height: 1 },
    },
    presets: [
      curvePreset(
        'curve',
        { label: '曲线', name: 'Curve' },
        DEFAULT_CURVE_PROPS,
        (size) => ({ ...DEFAULT_CURVE_GEOMETRY, end: { x: size.width, y: size.height } }),
        <ComposeLineMaterialIcon />,
        null,
        options.curve,
      ),
      curvePreset(
        'arrow',
        { label: '箭头', name: 'Arrow' },
        DEFAULT_ARROW_PROPS,
        (size) => ({ ...DEFAULT_CURVE_GEOMETRY, end: { x: size.width, y: size.height } }),
        <ComposeArrowMaterialIcon />,
        'toolbar',
        options.arrow,
      ),
      curvePreset(
        'circle',
        { label: '圆', name: 'Circle' },
        DEFAULT_CURVE_PROPS,
        () => DEFAULT_CIRCLE_GEOMETRY,
        <ComposeCircleMaterialIcon />,
        'toolbar',
        options.circle,
      ),
      /*
       * 矩形**不 paletteHidden**，这是对上面那条「工具栏已提供入口就不上面板」的一处有意
       * 偏离：物料面板是新手唯一的发现面，而矩形是最先被找的那一个。`R` 与它落地的是同一个
       * Preset，因此两条入口产出的东西逐字段相同——「同一个词指两件东西」正是这次要修的。
       *
       * 它与其他曲线一样**默认空心**：接线图上矩形绝大多数是设备外框与分区框，套在符号
       * 外面，默认填色会把里面的符号整片盖住。空心的代价是盒内部不命中，由两处承担——
       * 选中之后边缘的缩放命中带整条让到盒外（描边连同它的容差归移动），以及盒内双击进
       * 几何编辑。
       */
      curvePreset(
        'rect',
        { label: '矩形', name: 'Rectangle' },
        DEFAULT_CURVE_PROPS,
        composeRectangleGeometry,
        <ComposeRectMaterialIcon />,
        null,
        options.rect,
      ),
      curvePreset(
        'wire',
        { label: '导线', name: 'Wire' },
        DEFAULT_WIRE_PROPS,
        (size) => ({ ...DEFAULT_CURVE_GEOMETRY, end: { x: size.width, y: size.height } }),
        <ComposeLineMaterialIcon />,
        'always',
        options.wire,
      ),
      /*
       * 节点是曲线的**第五个起点**：一个填实的方块，外加它自己的那一个端口。接线时三条支路
       * 都绑到这个端口上，因此既有的「端点绑端口」协议一个字节不改——求解、失效判定、
       * `port` 最高捕捉优先级与 Inspector 全部白拿。
       *
       * `paletteHidden`：从物料面板拖出来的节点不连着任何导线，而一个不表达任何连接的实心块
       * 读不出意图。
       */
      curvePreset(
        'junction',
        { label: '节点', name: 'Junction' },
        DEFAULT_JUNCTION_PROPS,
        composeJunctionGeometry,
        // 图标跟着形状走：画布上是方块、场景树里是圆圈，等于同一件事在两个地方说两句不一样的
        // 话——而树正是用户在画布上点不中它时会去找它的地方。
        <ComposeRectMaterialIcon />,
        'always',
        options.junction,
        {
          fallbackSize: composeJunctionSize(COMPOSE_WIRE_STROKE_WIDTH),
          fallbackAppearance: DEFAULT_JUNCTION_APPEARANCE,
          components: (size) => ({
            Ports: {
              items: [{
                id: COMPOSE_JUNCTION_PORT_ID,
                position: { x: size.width / 2, y: size.height / 2 },
              }],
            },
            /*
             * 节点的尺寸**不是作者写下的量**：直径由导线线宽推出，因此八个手柄改的是一个
             * 读不出含义的数。更要紧的是端口——上面那个 `position` 在建它的这一刻烘成盒心，
             * 而 `getComposeEntityPorts` 原样读出、不按盒缩放：拉扁之后圆点的视觉中心挪了，
             * 支路却还汇聚在旧的局部坐标上，屏幕上与「接着」逐像素相同，直到用户挪一下符号
             * 才现形。**「端口恒在盒心」这条不变量是由「盒改不了」推出来的**，放开 `resize`
             * 的人 MUST 同时回答端口怎么跟。
             *
             * 走 `GeometryConstraints` 而不是在画布上按 presetId 挡手柄：`SCALE`、`MIRROR`、
             * 方向键、属性面板、粘贴各是一条路，而这个字段在命令层就被 `entity.transform.set`
             * 尊重，因此一次全部收口，且没有一条路径需要认识节点。
             *
             * `movable` 保持 true——挪接头是接线图上的常规操作；`rotatable` 关掉，一个圆转了
             * 等于没转，而屏幕上不该出现一个鼠标动了也没反应的控件。
             */
            GeometryConstraints: { movable: true, resize: 'none', rotatable: false },
          }),
        },
      ),
      /*
       * 填充是求面产出的那块色。它**从物料面板退役**（`'always'`）而不是按工具栏货架求值：
       * 从面板拖出来的是一块**没有 `Hatch`** 的色块——它与围出它的那些线没有任何关系，永远
       * 重新生成不了，而屏幕上与真填充逐像素相同。这与导线那一条同形：理由出自物料自身，
       * 与谁的货架上有没有按钮无关。
       *
       * 默认几何是矩形，因为拖不出来的东西也不该退化成一条线；真正的几何在落地那一刻由求面
       * 写进去。
       */
      curvePreset(
        'hatch',
        { label: '填充', name: 'Hatch' },
        DEFAULT_HATCH_PROPS,
        composeRectangleGeometry,
        <ComposeRectMaterialIcon />,
        'always',
        options.hatch,
        { fallbackAppearance: DEFAULT_HATCH_APPEARANCE },
      ),
    ],
  }
}

const curve = createCurveMaterial()
/** 默认 Curve Renderer。 @public */
export const DEFAULT_COMPOSE_CURVE_RENDERER = curve.renderer
/** 默认 Curve Entity Preset。 @public */
export const DEFAULT_COMPOSE_CURVE_PRESET = curve.presets[0]
/** 默认 Arrow Entity Preset。 @public */
export const DEFAULT_COMPOSE_ARROW_PRESET = curve.presets[1]
/** 默认 Circle Entity Preset。 @public */
export const DEFAULT_COMPOSE_CIRCLE_PRESET = curve.presets[2]
/** 默认 Rect Entity Preset。 @public */
export const DEFAULT_COMPOSE_RECT_PRESET = curve.presets[3]
/** 默认 Wire Entity Preset。 @public */
export const DEFAULT_COMPOSE_WIRE_PRESET = curve.presets[4]
/** 默认 Junction Entity Preset。 @public */
export const DEFAULT_COMPOSE_JUNCTION_PRESET = curve.presets[5]
