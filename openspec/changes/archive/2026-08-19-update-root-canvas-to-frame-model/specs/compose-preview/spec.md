## MODIFIED Requirements

### Requirement: Preview 配置与兼容
ComposePreview MUST require a document, a registry and a Frame target, and MUST render exactly one Frame.
When no target is given it MUST render the document's `defaultFrameId`, falling back to the first root Frame.
ComposePreview MUST accept optional `fit` (`contain | cover | fill | none`) and `alignment` props that
control how the Frame is mapped into the host box; these MUST NOT be read from or written to the document.
ComposePreview MUST NOT offer a legacy children container mode and MUST NOT keep a separate
whole-document rendering path.

#### Scenario: Required document configuration
- **WHEN** a consumer renders ComposePreview with a document, registry and optional Frame target
- **THEN** it renders that single Frame using the Frame's own size, background paint and clipping rules
- **AND** omitting the target renders the default root Frame

#### Scenario: Host-supplied fit
- **WHEN** a consumer renders the same document with `fit="contain"` and again with `fit="cover"`
- **THEN** the Frame is scaled differently in each host box
- **AND** the document snapshot is byte-identical in both cases

### Requirement: Preview Frame 背景 Paint

ComposePreview MUST 在目标 Frame 的边界内渲染该 Frame `Appearance.backgroundPaint` 的 Solid、
Linear、Radial 与 Angular 描述，并保持其位于该 Frame 全部后代 Entity 之后。嵌套 Frame MUST 各自
渲染自己的背景。Preview 不得渲染渐变编辑控制柄或其它 Editor chrome。

#### Scenario: 预览渐变输出背景

- **WHEN** v7 文档的根 Frame 使用任一合法 Gradient Paint
- **THEN** Preview 显示与 Stage Frame 边界一致的渐变背景
- **AND** Entity Appearance、Hierarchy 和 Clip 渲染顺序保持不变

#### Scenario: 嵌套 Frame 各自的背景

- **WHEN** 目标 Frame 内嵌套一个拥有不同背景 Paint 的子 Frame
- **THEN** 两层背景分别渲染在各自边界内，子 Frame 背景位于其自身后代之后
- **AND** 子 Frame 的裁剪与坐标原点独立于宿主 Frame

## RENAMED Requirements

- FROM: `### Requirement: Preview 输出背景 Paint`
- TO: `### Requirement: Preview Frame 背景 Paint`

## ADDED Requirements

### Requirement: Preview 嵌套 Frame 动画播放

ComposePreview MUST 按 Frame 播放动画：每个 Frame 使用自己 `Animations` 清单中的动画和自己的
时间轴。嵌套 Frame（组件实例、Page Slot）MUST 拥有独立播放状态，宿主 MUST 只能通过播放控制
（play/pause/seek/mode）影响嵌套 Frame，MUST NOT 采样或覆写嵌套 Frame 内部 Entity 的属性。

#### Scenario: 组件实例播放自己的动画

- **WHEN** 一个组件根 Frame 定义了动画，其实例被放入宿主 Frame 并预览
- **THEN** 实例按组件自身时间轴播放
- **AND** 宿主 Frame 的播放头不改变实例内部的采样结果

#### Scenario: 宿主控制嵌套播放状态

- **WHEN** 宿主对某个嵌套 Frame 发出 pause 与 seek
- **THEN** 该嵌套 Frame 停在指定时刻
- **AND** 宿主与其它嵌套 Frame 的播放状态不受影响
