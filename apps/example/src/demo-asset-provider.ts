import {
  ComposeAssetError,
  validateAssetName,
} from '@compose-ui/assets'
import {
  COMPOSE_PAGE_MEDIA_TYPE,
  createDefaultComposeLayoutItem,
  createEmptyComposeAppManifest,
  createComposeFrameEntity,
  createEmptyComposePageDocument,
  createEmptyComposePageFile,
  serializeComposeAppManifest,
  serializeComposePageFile,
} from '@compose-ui/core'
import type {
  ComposeAssetEntry,
  ComposeAssetProvider,
} from '@compose-ui/assets'
import type {
  ComposeDocument,
  ComposeEntity,
  ComposeInteractionAction,
} from '@compose-ui/core'

interface MemoryAsset {
  entry: ComposeAssetEntry
  content?: Blob
  /**
   * 首次读取时才取内容。
   *
   * @remarks
   * 真实图纸有一两兆，内联进模块会让每一次构建与每一条端到端用例都背着它。取回来之后写进
   * `content` 缓存，因此只付一次。
   */
  load?: () => Promise<Blob>
}

interface DemoPageSeed {
  readonly id: string
  readonly name: string
  readonly document: ComposeDocument
}

/** 示例应用用于演示 revision 冲突与离线快照的可控 Provider。 */
export interface DemoAssetProvider extends ComposeAssetProvider {
  readonly demo: {
    /** 仅推进指定资源的 revision，模拟另一个客户端已保存源文件。 */
    bumpRevision(assetKey: string): void
    /** 切换资源 I/O；订阅仍保持可用，以便界面观察离线状态。 */
    setOffline(offline: boolean): void
  }
}

const root: ComposeAssetEntry = {
  id: 'demo-assets',
  parentId: null,
  name: 'Demo Assets',
  kind: 'folder',
}

function revision(value: number) {
  return `demo-r${value}`
}

function createDemoBitmap() {
  const width = 256
  const height = 128
  const pixelOffset = 54
  const bytes = new Uint8Array(pixelOffset + width * height * 3)
  const view = new DataView(bytes.buffer)
  bytes.set([0x42, 0x4d])
  view.setUint32(2, bytes.length, true)
  view.setUint32(10, pixelOffset, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  for (let offset = pixelOffset; offset < bytes.length; offset += 3) {
    // BMP 使用 BGR；示例蓝色与 Stage accent 保持一致。
    bytes[offset] = 232
    bytes[offset + 1] = 120
    bytes[offset + 2] = 40
  }
  return new Blob([bytes], { type: 'image/bmp' })
}

function demoCounterDocument(navigation: boolean): ComposeDocument {
  return {
  ...createEmptyComposePageDocument(),
  rootIds: ['frame-root'],
  entities: {
    // v7 的文档根只接受 Frame；示例内容挂在这块画板下。
    'frame-root': createComposeFrameEntity({
      id: 'frame-root',
      name: '场景',
      childIds: navigation
        ? ['demo-counter-value', 'demo-counter-button', 'demo-counter-back']
        : ['demo-counter-value', 'demo-counter-button'],
    }),
    'demo-counter-value': {
      id: 'demo-counter-value',
      name: 'Counter value',
      components: {
        Composition: { presetId: 'text', baseComponentKeys: [], capabilityIds: [] },
        Transform: { rotation: 0 },
        LayoutItem: createDefaultComposeLayoutItem(280, 72, { x: 80, y: 80 }),
        Visibility: { visible: true },
        Lock: { locked: false },
        Renderer: { type: 'text', props: { text: 0, color: '#dce8fa', fontSize: 42 } },
        Bindings: {
          version: 1,
          rendererProps: {
            fields: { text: { scope: 'page', exportName: 'num' } },
          },
        },
      },
    },
    ...(navigation
      ? {
          'demo-counter-back': demoNavigationEntity({
            id: 'demo-counter-back',
            name: '返回',
            text: '← 返回',
            offset: { x: 80, y: 260 },
            action: { type: 'navigate-back' },
          }),
        }
      : {}),
    'demo-counter-button': {
      id: 'demo-counter-button',
      name: 'Add button',
      components: {
        Composition: { presetId: 'action-button', baseComponentKeys: [], capabilityIds: [] },
        Transform: { rotation: 0 },
        LayoutItem: createDefaultComposeLayoutItem(160, 52, { x: 80, y: 180 }),
        Visibility: { visible: true },
        Lock: { locked: false },
        Renderer: { type: 'action-button', props: { label: 'Add' } },
        Bindings: {
          version: 1,
          rendererProps: {
            fields: {
              label: { scope: 'page', exportName: 'buttonLabel' },
              onClick: { scope: 'page', exportName: 'onAdd' },
            },
          },
        },
      },
    },
  },
  }
}
/** 跳转目标的稳定引用；两块页面互相指向对方。 */
function demoPageReference(assetKey: string) {
  return { kind: 'page' as const, providerId: 'demo-memory', assetKey, scope: 'persistent' as const }
}

/** 一个只有文字与跳转的矩形；示例里的跳转源不是按钮物料，正好演示任意 Entity 都能跳。 */
function demoNavigationEntity(input: {
  readonly id: string
  readonly name: string
  readonly text: string
  readonly offset: { readonly x: number; readonly y: number }
  readonly action: ComposeInteractionAction
}): ComposeEntity {
  return {
    id: input.id,
    name: input.name,
    components: {
      Composition: { presetId: 'text', baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: createDefaultComposeLayoutItem(240, 56, input.offset),
      Visibility: { visible: true },
      Lock: { locked: false },
      Appearance: { backgroundPaint: { kind: 'solid', color: '#1d4ed8' }, borderRadius: 8 },
      Renderer: { type: 'text', props: { text: input.text, color: '#e8f0ff', fontSize: 20 } },
      Interaction: { version: 1, triggers: [{ event: 'click', action: input.action }] },
    },
  }
}

/**
 * 首页 setup 脚本。
 *
 * @remarks
 * `openMs` / `closedMs` 只在刀闸演示下导出：页面脚本的返回成员会出现在属性面板里，
 * 默认多两个成员会改变所有以既有成员表为前提的端到端用例——与「首页默认不放跳转入口」
 * 是同一条判断。
 */
function demoHomeSetupText(switchDemo: boolean): string {
  const switchExports = switchDemo
    ? `
  // 组件实例播放头示例：同一个组件的两个实例各绑一个数，同一帧呈现两个姿态。
  // 业务侧给的是「这台设备现在什么状态」，而不是「播还是不播」——状态用时间轴表达。
  const openMs = ctx.state(0)
  const closedMs = ctx.state(200)`
    : ''
  const switchMembers = switchDemo ? ', openMs, closedMs' : ''
  return `export function setup(ctx) {
  const num = ctx.state(0)
  const onAdd = () => { num.value += 1 }
  const buttonLabel = ctx.computed(() => num.value === 0 ? 'Add' : \`Add \${num.value}\`)
  // 动画播放控制示例：把 animate 绑定到动画检查器的"播放"，预览中即自动播放；
  // onToggleAnimate 可绑到按钮，false -> true 的上升沿会让动画从头重播。
  const animate = ctx.state(true)
  const onToggleAnimate = () => { animate.value = !animate.value }${switchExports}
  return { num, onAdd, buttonLabel, animate, onToggleAnimate${switchMembers} }
}
`
}

/**
 * 首页文档。
 *
 * @remarks
 * 跳转入口只在导航演示下出现：首页是编辑器启动时打开的页面，往它的默认内容里塞东西会
 * 改变所有以空白首页为前提的端到端用例。
 */
function demoHomeDocument(navigation: boolean): ComposeDocument {
  if (!navigation) return createEmptyComposePageDocument()
  return {
    ...createEmptyComposePageDocument(),
    rootIds: ['frame-root'],
    entities: {
      'frame-root': createComposeFrameEntity({
        id: 'frame-root',
        name: '场景',
        childIds: ['demo-home-goto-counter'],
      }),
      'demo-home-goto-counter': demoNavigationEntity({
        id: 'demo-home-goto-counter',
        name: '去计数器',
        text: '去计数器 →',
        offset: { x: 80, y: 80 },
        action: { type: 'navigate', target: demoPageReference('demo-counter-page') },
      }),
    },
  }
}

// Home 页挂同一份 setup：动画播放控制示例需要页面导出（animate 布尔）可绑定。
const demoHomePageText = (navigation: boolean) => serializeComposePageFile({
  ...createEmptyComposePageFile(),
  document: demoHomeDocument(navigation),
  setupScript: {
    providerId: 'demo-memory',
    assetKey: 'demo-home-setup',
    scope: 'persistent',
  },
})
const demoAppManifestText = serializeComposeAppManifest({
  ...createEmptyComposeAppManifest(),
  // 示例工作区需要一个确定首页，Home 不能只是孤立的页面资源。
  homePageKey: 'demo-home-page',
})
const demoCounterPageText = (navigation: boolean) => serializeComposePageFile({
  ...createEmptyComposePageFile(),
  document: demoCounterDocument(navigation),
  setupScript: {
    providerId: 'demo-memory',
    assetKey: 'demo-home-setup',
    scope: 'persistent',
  },
})

/**
 * 示例应用的实例级内存 Provider，只用于展示资源协议，不属于公共持久化实现。
 */
/**
 * 一份最小的演示 DXF：两个图层、两个符号块与它们的插入、一条导线、一段标注与一个圆。
 *
 * @remarks
 * 坐标全部取在 Y **正**方向上（DXF 的 Y 朝上），因此导入之后应当落在负 Y 上——这份夹具同时
 * 在演示与端到端里承担「翻转做没做对」的判据。末尾故意留一个 `SPLINE`：它没有对应图元，
 * 用来演示「导入能导的，报告导不了的」。
 *
 * `TERMINAL` 的基点 `(-30, 0)` **落在自身几何包围盒之外**，且它那次插入带 180 度旋转：块基点
 * 若被写成盒中心，转出来的位置会差整整一个基点偏移，而这个错误在基点落在盒内时看不出来。
 */
/**
 * 一个刀闸符号的演示 SVG。
 *
 * @remarks
 * 这份夹具同时承担三件事：
 *
 * - **每个部件是一个 Entity**：`blade`（刀）与两个端子各自可选中，改一个的颜色不会波及另一个。
 * - **样式在导入期求值掉**：描边写在 `<style>` 的 class 上，文档里不该留下任何 class。
 * - **不能表达的属性降级、元素永不丢弃**：`nameplate` 带滤镜与渐变填充，它必须仍然在场景树里，
 *   同时出现在诊断里。
 *
 * `viewBox` 与 `width` 一致，因此导入之后的坐标就是这里写的数——端到端断言可以直接读它们。
 */
/*
 * 一个隔离开关（刀闸）符号。
 *
 * **每个图形都要写 `fill`**：SVG 的 `fill` 默认值是黑色，漏掉的图形在浏览器里就是一块黑，
 * 导入器忠实照搬因此画布上也是一块黑——看起来像导入坏了，实际是素材坏了。这里靠 `.lead`
 * 上的 `fill:none` 统一给出，唯一的例外是铭牌，它要显式填充。
 *
 * **符号画在 160×260 而不是 40×60**：端到端用例在 `?no-auto-fit` 下跑，缩放恒为 1，因此一个
 * SVG 单位就是一个屏幕像素，而夹点与控制手柄的命中框是 16px 见方。画在 40×60 上时整条软连接
 * 只有十几个像素宽，四个手柄的命中框叠成一团，按向某一个抓到的是相邻那一个。放大是坐标的
 * 整体缩放，形状一个像素都没变。
 */
const demoSvgText = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 260" width="160" height="260">',
  '<style>.lead{stroke:#33aa55;stroke-width:8;fill:none;stroke-linecap:round}</style>',
  '<defs>',
  '<linearGradient id="plate"><stop stop-color="#ff0000"/><stop stop-color="#0000ff"/></linearGradient>',
  '<filter id="glow"><feGaussianBlur stdDeviation="4"/></filter>',
  '</defs>',
  '<g id="terminals">',
  '<line id="lead-top" class="lead" x1="80" y1="8" x2="80" y2="64"/>',
  '<line id="contact-fixed" class="lead" x1="52" y1="64" x2="108" y2="64"/>',
  '<line id="lead-bottom" class="lead" x1="80" y1="240" x2="80" y2="254"/>',
  '</g>',
  '<line id="blade" class="lead" x1="80" y1="180" x2="124" y2="76"/>',
  '<circle id="hinge" class="lead" cx="80" cy="180" r="6.4"/>',
  // 灭弧罩：一段二次贝塞尔，导入期升次成三次；开放路径的首尾各只有一侧控制手柄。
  '<path id="arcmark" class="lead" d="M48 48 Q 80 12 112 48"/>',
  /*
   * 铰点到下端子的软连接。两段三次贝塞尔，因此中间那个顶点两侧各有一个控制点——对称拖动
   * 只有在这样的顶点上才看得见。四个控制点**刻意两两相隔三十个像素以上**：命中框重叠时
   * 按向某一个抓到的是哪一个全凭叠放次序，而相邻顶点的手柄（这一个的出向与下一个的入向）
   * 恰恰最容易挤在一起。
   */
  '<path id="flex" class="lead" d="M80 180 C 124 180 124 210 80 210 C 36 210 36 240 80 240"/>',
  '<rect id="nameplate" x="8" y="104" width="36" height="24" rx="6" fill="url(#plate)" filter="url(#glow)"/>',
  '</svg>',
].join('')

/**
 * 一份**永不被读取**的 DWG 占位内容。
 *
 * @remarks
 * `.dwg` 上的菜单项只按文件名判断，从不打开文件——DWG 导不进来，那一项给的是「先转成 DXF」
 * 的说明。真造一份合法的 DWG 只会让人以为它已经能解析了。`AC1032` 是 AutoCAD 2018 的版本
 * 标识，留着是为了让人一眼看出这是什么格式的占位。
 */
const demoDwgPlaceholder = 'AC1032'

const demoDxfText = [
  '0', 'SECTION', '2', 'TABLES',
  '0', 'TABLE', '2', 'LAYER',
  '0', 'LAYER', '2', '0', '62', '7', '70', '0',
  '0', 'LAYER', '2', 'WIRE', '62', '1', '70', '0',
  '0', 'ENDTAB', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'BLOCKS',
  '0', 'BLOCK', '2', 'SWITCH', '10', '0', '20', '0',
  '0', 'LWPOLYLINE', '8', '0', '70', '1',
  '10', '-20', '20', '-10', '10', '20', '20', '-10',
  '10', '20', '20', '10', '10', '-20', '20', '10',
  '0', 'ENDBLK',
  '0', 'BLOCK', '2', 'TERMINAL', '10', '-30', '20', '0',
  '0', 'LWPOLYLINE', '8', '0', '70', '1',
  '10', '0', '20', '0', '10', '10', '20', '0',
  '10', '10', '20', '10', '10', '0', '20', '10',
  '0', 'ENDBLK',
  '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'INSERT', '8', '0', '2', 'SWITCH', '10', '100', '20', '300',
  '0', 'INSERT', '8', '0', '2', 'SWITCH', '10', '300', '20', '300',
  '0', 'INSERT', '8', '0', '2', 'TERMINAL', '10', '150', '20', '320', '50', '180',
  '0', 'LINE', '8', 'WIRE', '10', '120', '20', '300', '11', '280', '21', '300',
  '0', 'TEXT', '8', '0', '10', '100', '20', '330', '40', '12', '1', 'SW-01', '72', '1',
  '0', 'CIRCLE', '8', 'WIRE', '10', '200', '20', '360', '40', '18',
  '0', 'SPLINE', '8', '0',
  '0', 'ENDSEC', '0', 'EOF',
].join('\n') + '\n'

export function createDemoAssetProvider(options: {
  readonly pages?: readonly DemoPageSeed[]
  /**
   * 是否在示例页面上放置跳转入口。
   *
   * @remarks
   * 默认关闭：首页是编辑器启动时打开的页面，默认往它的内容里加东西会改变所有以空白
   * 首页为前提的端到端用例。示例应用用 `?page-preview` 打开。
   */
  readonly navigationDemo?: boolean
  /**
   * 是否导出两个供组件实例播放头绑定的数值（`openMs` / `closedMs`）。
   *
   * @remarks
   * 默认关闭，理由与 `navigationDemo` 相同：页面脚本返回成员被既有端到端用例断言，
   * 默认多两个成员会改掉它们。示例应用用 `?switch-demo` 打开。
   */
  readonly switchDemo?: boolean
  /**
   * 是否把 `apps/example/symbols/` 整个映射成资源浏览器里的 `Symbols` 文件夹。
   *
   * @remarks
   * 默认关闭，理由与上面两个相同：图片资源库列出 Provider 里的全部图片，而 `.svg` 算图片——
   * 默认打开会让那张黄金图凭空多出二十项。示例应用用 `?symbols` 打开。
   */
  readonly symbols?: boolean
} = {}): DemoAssetProvider {
  const navigationDemo = options.navigationDemo ?? false
  const switchDemo = options.switchDemo ?? false
  const symbols = options.symbols ?? false
  const homePageText = demoHomePageText(navigationDemo)
  const counterPageText = demoCounterPageText(navigationDemo)
  let revisionNumber = 1
  let offline = false
  const listeners = new Set<() => void>()
  const assets = new Map<string, MemoryAsset>([
    [root.id, { entry: root }],
    ['demo-images', {
      entry: {
        id: 'demo-images',
        parentId: root.id,
        name: 'Images',
        kind: 'folder',
      },
    }],
    ['compose-logo', {
      entry: {
        id: 'compose-logo',
        parentId: 'demo-images',
        name: 'compose-grid.svg',
        kind: 'file',
        mediaType: 'image/svg+xml',
        size: 604,
        revision: revision(revisionNumber),
        assetKey: 'compose-logo',
      },
      content: new Blob([
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">'
        + '<defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#2878e8"/>'
        + '<stop offset="1" stop-color="#70a7ff"/></linearGradient></defs>'
        + '<rect width="640" height="360" rx="24" fill="#121820"/>'
        + '<path d="M0 72h640M0 144h640M0 216h640M0 288h640M128 0v360M256 0v360M384 0v360M512 0v360" stroke="#344151"/>'
        + '<rect x="176" y="92" width="288" height="176" rx="12" fill="url(#g)"/>'
        + '<text x="320" y="190" text-anchor="middle" fill="white" font-family="system-ui" font-size="34">Compose UI</text>'
        + '</svg>',
      ], { type: 'image/svg+xml' }),
    }],
    ['dashboard-image', {
      entry: {
        id: 'dashboard-image',
        parentId: 'demo-images',
        name: 'dashboard.bmp',
        kind: 'file',
        mediaType: 'image/bmp',
        size: 98_358,
        revision: revision(revisionNumber),
        assetKey: 'dashboard-image',
      },
      content: createDemoBitmap(),
    }],
    ['dashboard-script', {
      entry: {
        id: 'dashboard-script',
        parentId: root.id,
        name: 'dashboard.ts',
        kind: 'file',
        mediaType: 'text/typescript',
        size: 118,
        revision: revision(revisionNumber),
        assetKey: 'dashboard-script',
      },
      content: new Blob([
        "export const dashboard = {\n  title: 'Operations overview',\n  refreshInterval: 30,\n  theme: 'dark',\n}\n",
      ], { type: 'text/typescript' }),
    }],
    ['demo-topology-dxf', {
      entry: {
        id: 'demo-topology-dxf',
        parentId: root.id,
        name: 'Topology.dxf',
        kind: 'file',
        mediaType: 'image/vnd.dxf',
        size: demoDxfText.length,
        revision: revision(revisionNumber),
        assetKey: 'demo-topology-dxf',
      },
      content: new Blob([demoDxfText], { type: 'image/vnd.dxf' }),
    }],
    ['demo-ems-dxf', {
      entry: {
        id: 'demo-ems-dxf',
        parentId: root.id,
        name: 'EMS.dxf',
        kind: 'file',
        mediaType: 'image/vnd.dxf',
        size: 1371730,
        revision: revision(revisionNumber),
        assetKey: 'demo-ems-dxf',
      },
      // 一份真实的现场图纸（AC1024、五千多个实体、四个块）。它是导入器唯一的真实世界夹具：
      // 手写的小夹具覆盖不到的东西——`$` 开头的匿名块名、`TRACE`/`HATCH`/`MTEXT` 的密度、
      // 几千个实体的量级——全都只在这种文件上才出现。
      load: async () => (await fetch('ems.dxf')).blob(),
    }],
    ['demo-feeder-dwg', {
      entry: {
        id: 'demo-feeder-dwg',
        parentId: root.id,
        name: 'Feeder.dwg',
        kind: 'file',
        mediaType: 'image/vnd.dwg',
        size: demoDwgPlaceholder.length,
        revision: revision(revisionNumber),
        assetKey: 'demo-feeder-dwg',
      },
      content: new Blob([demoDwgPlaceholder], { type: 'image/vnd.dwg' }),
    }],
    ['demo-disconnector-svg', {
      entry: {
        id: 'demo-disconnector-svg',
        parentId: root.id,
        name: 'Disconnector.svg',
        kind: 'file',
        mediaType: 'image/svg+xml',
        size: demoSvgText.length,
        revision: revision(revisionNumber),
        assetKey: 'demo-disconnector-svg',
      },
      content: new Blob([demoSvgText], { type: 'image/svg+xml' }),
    }],
    ['demo-pages', {
      entry: {
        id: 'demo-pages',
        parentId: root.id,
        name: 'Pages',
        kind: 'folder',
      },
    }],
    ['demo-app-manifest', {
      entry: {
        id: 'demo-app-manifest',
        parentId: root.id,
        name: 'app.json',
        kind: 'file',
        mediaType: 'application/json',
        size: demoAppManifestText.length,
        revision: revision(revisionNumber),
        assetKey: 'demo-app-manifest',
      },
      content: new Blob([demoAppManifestText], { type: 'application/json' }),
    }],
    ['demo-home-page', {
      entry: {
        id: 'demo-home-page',
        parentId: 'demo-pages',
        name: 'Home.page.json',
        kind: 'file',
        // 页面文件必须上报页面媒体类型，宿主据此在不读内容的前提下识别页面。
        mediaType: COMPOSE_PAGE_MEDIA_TYPE,
        size: homePageText.length,
        revision: revision(revisionNumber),
        assetKey: 'demo-home-page',
      },
      content: new Blob([homePageText], { type: COMPOSE_PAGE_MEDIA_TYPE }),
    }],
    ['demo-counter-page', {
      entry: {
        id: 'demo-counter-page',
        parentId: 'demo-pages',
        name: 'Counter.page.json',
        kind: 'file',
        mediaType: COMPOSE_PAGE_MEDIA_TYPE,
        size: counterPageText.length,
        revision: revision(revisionNumber),
        assetKey: 'demo-counter-page',
      },
      content: new Blob([counterPageText], { type: COMPOSE_PAGE_MEDIA_TYPE }),
    }],
    ['demo-home-setup', {
      entry: {
        id: 'demo-home-setup',
        parentId: 'demo-pages',
        name: 'Counter.setup.js',
        kind: 'file',
        mediaType: 'text/javascript',
        revision: revision(revisionNumber),
        assetKey: 'demo-home-setup',
      },
      content: new Blob([demoHomeSetupText(switchDemo)], { type: 'text/javascript' }),
    }],
    ['readme', {
      entry: {
        id: 'readme',
        parentId: root.id,
        name: 'README.md',
        kind: 'file',
        mediaType: 'text/markdown',
        size: 80,
        revision: revision(revisionNumber),
        assetKey: 'readme',
      },
      content: new Blob(['# Demo assets\n\nFiles are stored by an in-memory ComposeAssetProvider.\n']),
    }],
  ])

  if (symbols) {
    assets.set('demo-symbols', {
      entry: { id: 'demo-symbols', parentId: root.id, name: 'Symbols', kind: 'folder' },
    })
    /*
     * 目录整个映射进来而不是逐个列举：这批素材存在的意义就是「往文件夹里丢一个 `.svg`，
     * 资源浏览器里就多一项」，逐个列举会让每加一个素材都要改一次这里，而漏改的症状是
     * 「文件明明在盘上却导不进来」。
     *
     * 一级子目录成为资源浏览器里的子文件夹：素材按元件分类摆放，铺平成五十多项一列会让
     * 「找到那一个」变成翻页。更深的层级不做——素材库没有，做了也没有东西验证它。
     */
    for (const [path, text] of Object.entries(
      import.meta.glob('../symbols/**/*.svg', { query: '?raw', import: 'default', eager: true }),
    ) as [string, string][]) {
      const segments = path.replace('../symbols/', '').split('/')
      const name = segments[segments.length - 1]!
      const category = segments.length > 1 ? segments[0]! : null
      const parentId = category === null ? 'demo-symbols' : `demo-symbols-${category}`
      if (category !== null && !assets.has(parentId)) {
        assets.set(parentId, {
          entry: { id: parentId, parentId: 'demo-symbols', name: category, kind: 'folder' },
        })
      }
      const id = `demo-symbol-${category ?? ''}-${name}`
      assets.set(id, {
        entry: {
          id,
          parentId,
          name,
          kind: 'file',
          mediaType: 'image/svg+xml',
          size: text.length,
          revision: revision(revisionNumber),
          assetKey: id,
        },
        content: new Blob([text], { type: 'image/svg+xml' }),
      })
    }
  }

  options.pages?.forEach((page) => {
    const text = serializeComposePageFile({ ...createEmptyComposePageFile(), document: page.document })
    assets.set(page.id, {
      entry: {
        id: page.id,
        parentId: 'demo-pages',
        name: page.name,
        kind: 'file',
        mediaType: COMPOSE_PAGE_MEDIA_TYPE,
        size: text.length,
        revision: revision(revisionNumber),
        assetKey: page.id,
      },
      content: new Blob([text], { type: COMPOSE_PAGE_MEDIA_TYPE }),
    })
  })

  const notify = () => {
    for (const listener of listeners) listener()
  }
  const assertOnline = () => {
    if (offline) throw new ComposeAssetError('io', 'Demo Asset Provider is offline')
  }
  const requireEntry = (id: string) => {
    const asset = assets.get(id)
    if (!asset) throw new ComposeAssetError('not-found', `Unknown asset ${id}`)
    return asset
  }
  const assertUnique = (parentId: string, name: string, exceptId?: string) => {
    if ([...assets.values()].some((asset) => (
      asset.entry.id !== exceptId
      && asset.entry.parentId === parentId
      && asset.entry.name === name
    ))) throw new ComposeAssetError('conflict', `Asset "${name}" already exists`)
  }

  return {
    id: 'demo-memory',
    label: 'Demo Assets',
    root,
    capabilities: {
      createFile: true,
      createFolder: true,
      rename: true,
      move: true,
      delete: true,
      write: true,
      reference: true,
    },
    referenceScope: 'persistent',
    demo: {
      bumpRevision(assetKey) {
        const asset = [...assets.values()].find(
          (candidate) => candidate.entry.assetKey === assetKey,
        )
        if (!asset) throw new ComposeAssetError('not-found', `Unknown asset key ${assetKey}`)
        revisionNumber += 1
        asset.entry = { ...asset.entry, revision: revision(revisionNumber) }
        notify()
      },
      setOffline(value) {
        if (offline === value) return
        offline = value
        notify()
      },
    },
    async list({ folderId, signal }) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      assertOnline()
      return [...assets.values()]
        .map((asset) => asset.entry)
        .filter((entry) => entry.parentId === folderId)
    },
    async read({ fileId, signal }) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      assertOnline()
      const asset = requireEntry(fileId)
      if (!asset.content && asset.load) asset.content = await asset.load()
      if (!asset.content) throw new ComposeAssetError('unsupported', 'Cannot read a folder')
      return {
        blob: asset.content,
        revision: asset.entry.revision ?? revision(revisionNumber),
      }
    },
    async resolveAsset({ assetKey, signal }) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      assertOnline()
      const asset = [...assets.values()].find(
        (candidate) => candidate.entry.assetKey === assetKey,
      )
      if (!asset?.content) {
        throw new ComposeAssetError('not-found', `Unknown asset key ${assetKey}`)
      }
      return {
        blob: asset.content,
        revision: asset.entry.revision ?? revision(revisionNumber),
        mediaType: asset.entry.mediaType ?? asset.content.type,
      }
    },
    async createFolder({ parentId, name }) {
      assertOnline()
      const normalized = validateAssetName(name)
      assertUnique(parentId, normalized)
      const id = `folder-${crypto.randomUUID()}`
      const entry: ComposeAssetEntry = {
        id,
        parentId,
        name: normalized,
        kind: 'folder',
      }
      assets.set(id, { entry })
      notify()
      return entry
    },
    async createFile({ parentId, name, content }) {
      assertOnline()
      const normalized = validateAssetName(name)
      assertUnique(parentId, normalized)
      revisionNumber += 1
      const id = `file-${crypto.randomUUID()}`
      const entry: ComposeAssetEntry = {
        id,
        parentId,
        name: normalized,
        kind: 'file',
        mediaType: content.type || undefined,
        size: content.size,
        revision: revision(revisionNumber),
        assetKey: id,
      }
      assets.set(id, { entry, content })
      notify()
      return entry
    },
    async renameEntry({ entryId, name }) {
      assertOnline()
      const asset = requireEntry(entryId)
      const normalized = validateAssetName(name)
      assertUnique(asset.entry.parentId ?? root.id, normalized, entryId)
      asset.entry = { ...asset.entry, name: normalized }
      notify()
      return asset.entry
    },
    async moveEntry({ entryId, parentId }) {
      assertOnline()
      const asset = requireEntry(entryId)
      assertUnique(parentId, asset.entry.name, entryId)
      asset.entry = { ...asset.entry, parentId }
      notify()
      return asset.entry
    },
    async deleteEntry({ entryId, recursive }) {
      assertOnline()
      const descendants = [...assets.values()]
        .filter((asset) => asset.entry.parentId === entryId)
      if (descendants.length > 0 && !recursive) {
        throw new ComposeAssetError('io', 'Folder is not empty')
      }
      const remove = (id: string) => {
        for (const child of [...assets.values()].filter((asset) => asset.entry.parentId === id)) {
          remove(child.entry.id)
        }
        assets.delete(id)
      }
      remove(entryId)
      notify()
    },
    async writeFile({ fileId, content, expectedRevision, force }) {
      assertOnline()
      const asset = requireEntry(fileId)
      if (!force && asset.entry.revision !== expectedRevision) {
        throw new ComposeAssetError('conflict', 'Asset revision changed')
      }
      revisionNumber += 1
      asset.content = content
      asset.entry = {
        ...asset.entry,
        size: content.size,
        revision: revision(revisionNumber),
      }
      notify()
      return asset.entry
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
