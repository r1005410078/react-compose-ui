## MODIFIED Requirements

### Requirement: 底部 Asset Browser 工作区

Editor MUST 在既有 bottom Edge Group 中提供“资源 / Assets”“动画 / Animation”标签，并固定资源、
动画、命令、日志的标签顺序；Transaction Log MUST 继续作为默认活动标签，Assets 与 Animation MUST
保持 inactive 初始状态。`ComposeEditorProps` MUST 新增 `assetBrowserProps` 与
`assetBrowserPanel`；显式 panel 优先于 props，二者缺失时显示可访问占位。Bottom Edge Group MUST
横跨 Scene/Canvas/Inspector 下方的完整编辑器宽度，保持可调整高度、折叠和组件实例内临时布局；
动画内容 MAY 由 `ComposeEditorSlots.animation` 覆盖。Editor MUST NOT 转导 Asset Browser 公共 API。

#### Scenario: 打开默认资源面板

- **WHEN** 宿主提供 assetBrowserProps 并打开底部资源标签
- **THEN** 标签显示 `@compose-ui/asset-browser` 的左树右资源界面
- **AND** Canvas、其他 Edge Group 和既有面板保持挂载及原尺寸

#### Scenario: 覆盖或省略资源内容

- **WHEN** 宿主提供 assetBrowserPanel，包括显式 null
- **THEN** 资源标签使用该值完整覆盖默认 AssetBrowser
- **WHEN** 宿主未提供 panel 或 props
- **THEN** 资源标签显示本地化、可访问的资源占位

#### Scenario: 保持底部默认活动标签与固定顺序

- **WHEN** Editor 首次初始化 bottom Edge Group
- **THEN** 该组按资源、动画、命令、日志的固定顺序包含 Assets、Animation、Command 和 Transaction Log
- **AND** Transaction Log 保持活动，Assets 与 Animation 初始 inactive

#### Scenario: 打开默认动画面板

- **WHEN** 宿主提供动画配置且用户打开底部动画标签
- **THEN** 完整宽度区域显示当前容器范围的时间轴、轨道和播放控制
- **AND** 左侧、Canvas 与右侧面板都结束在动画区域上边界且保持挂载

#### Scenario: 缺少动画配置

- **WHEN** 宿主未提供 Animation Store/Resolver 且未覆盖 animation slot
- **THEN** 动画标签显示本地化可访问的未配置状态
- **AND** 其他底部标签和既有工作区保持可用

## ADDED Requirements

### Requirement: 动画选择驱动上下文 Inspector

Editor MUST 协调 Scene Tree、Stage、动画时间轴和右侧 Inspector 的选择。节点选择 MUST 显示节点
Animation 能力；关键帧选择 MUST 显示帧序号、时间、属性值和进入该帧的 easing；区间选择 MUST 显示
Curve/Spring/Hold 编辑器。时间轴选择是编辑器会话状态，不得写入 ComposeDocument 或 Dockview 布局。

#### Scenario: 节点与关键帧 Inspector 切换
- **WHEN** 用户先选择动画节点，再选择其 200ms 关键帧，最后清除时间轴选择
- **THEN** Inspector 依次显示节点能力、关键帧上下文、节点能力
- **AND** 三次切换都不提交文档事务

#### Scenario: 切换活动页面清理动画会话
- **WHEN** 用户在关键帧草稿存在时切换活动页面或组件文档
- **THEN** Editor 按 dirty 关闭保护处理当前动画资源并清除旧选择和播放调度
- **AND** 新页面只显示自身容器范围动画

