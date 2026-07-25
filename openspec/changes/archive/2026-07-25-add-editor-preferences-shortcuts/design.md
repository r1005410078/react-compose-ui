## 上下文

ComposeEditor 通过 Dockview 组合多个独立包。首轮设置实现已经提供实例偏好、快捷键、主题和
本地化，但 locale 仍由 editor 逐个 clone/prop 注入，主题依赖 editor CSS 对独立包的祖先覆盖，
设置也仍是左侧非模态 aside。这让宿主插槽无法读取统一 UI 环境，独立包的浅色与英文能力也
无法在组合边界外复用。

偏好必须只属于当前编辑器实例；宿主可以受控持久化，但 editor 本身不得读写 localStorage，
也不得把偏好写入 ComposeDocument 或事务历史。独立包不得反向依赖 editor。

## 目标/非目标

- 目标：提供可嵌入、受控/非受控的设置中心与完整默认主题/语言切换。
- 目标：建立与 editor 解耦的共享 Theme/I18n Context，支持嵌套覆盖和独立包消费。
- 目标：把设置中心重构为编辑器范围内、带分类导航的可访问模态弹框。
- 目标：统一解析、显示和执行可修改快捷键，并可靠隔离输入控件与 IME。
- 目标：让临时平移在 Stage 任意命中区域遵守相同 pointer capture 生命周期。
- 非目标：自动翻译宿主插槽、registry 标签和业务组件；提供多段 chord；持久化用户账号设置。

## 决策

### 共享 UI Context 与依赖边界

- 新增 `@compose-ui/ui-context`，只依赖 React peer，不依赖 editor、core 或任一工作区组件。
  包公开 ThemeProvider、I18nProvider、组合 UIProvider、可空读取 Hook、主题/语言类型、语义
  token 与消息覆盖协议。
- Provider 嵌套时，未指定 theme/locale 继承父值，Dark/Light token 覆盖和 message overrides
  按父到子浅合并；ComposeEditor 内层 Provider 用 preferences 决定 theme/locale，但继承宿主
  外层的 token 与消息覆盖。
- 独立组件解析顺序固定为显式 locale 属性、最近 I18n Context、既有独立默认值；locale 属性
  保留为兼容覆盖。主题来自最近 Theme Context，无 Provider 时使用既有 dark 外观。
- Editor 不再 clone locale；只继续注入 Stage 快捷键和 controller 会话回调。Core、Preview
  与 component-registry 不依赖共享 Context。

### 主题 token 与消息格式化

- ThemeProvider 负责解析 system 并监听 `prefers-color-scheme`，Context 同时提供原始 theme、
  resolvedTheme 与合并后的语义 tokens。
- 默认 tokens 下沉到共享包，覆盖 workspace/panel、surface、border、text、accent、focus、
  danger、scrollbar 与 shadow。组件根节点设置 resolved `data-compose-theme` 和 token CSS
  variables；显式 style 最后合并，允许单实例覆盖。
- I18n Context 提供 locale 和 `formatMessage(id, fallback, variables)`；消息覆盖是稳定
  namespace ID 到模板字符串的映射，`{name}` 变量仅替换调用方提供的字符串或数字。
- 每个包保留自己的完整 zh-CN/en-US 内建词典，Context 不形成到消费者的反向依赖。宿主
  registry label、自定义 Schema metadata、插槽和业务内容保持原文。
- PropertyPanel 纯绑定解析继续产生稳定 issue code 与兼容 message；React 展示按 code 经
  Context 格式化，不把 React 或 locale 引入纯逻辑。

### 偏好归属与公共协议

- editor 的 theme/locale 类型改为共享类型的兼容别名，preferences schema、受控/非受控规则和
  完整回调保持不变。
- `preferences` 存在时由宿主完全受控；否则从 `defaultPreferences` 建立组件实例状态。每次有效
  变更都调用 `onPreferencesChange` 并返回完整规范化对象。

### 键位模型

- 持久表示使用 `KeyboardEvent.code`，修饰键使用 `primary`、`shift`、`alt`，其中 primary
  在 macOS 映射 Meta，其他平台映射 Ctrl。
- 每个 action 首版只有一个 binding；空值表示禁用。捕获只接受单次 keydown，不接受多段 chord。
- 冲突只在同一作用域内比较规范化 binding；发生冲突时拒绝写入并显示已有动作。
- 输入、textarea、select、contenteditable 与 composing 事件忽略 Stage 导航快捷键；历史
  快捷键继续使用其既有文档级语义。

### VS Code 式模态设置

- 现有齿轮改为 button，并通过 WorkspaceContentContext 接收 editor 根级的 open/toggle 回调。
- 弹框作为 editor root 内 Dockview 的绝对定位 sibling 渲染，使用遮罩、`role=dialog`、
  `aria-modal` 与焦点陷阱，不 portal 到宿主页面，也不改变 Dockview 分组尺寸。
- 弹框顶部为全局搜索，左侧固定“用户 / 外观 / 语言 / 键盘快捷方式”分类，右侧只显示活动
  分类；有查询时改为跨分类结果，点击分类清空查询。
- 设置即时生效。普通 Escape、遮罩、关闭按钮、齿轮或设置快捷键关闭；快捷键捕获期间 Escape
  只取消捕获。关闭后恢复齿轮焦点，每次重新打开重置为外观分类和空查询。
- Dockview 在打开期间 inert，弹框宽高不超过 960×680 且始终保留 24px editor 内边距。

### Stage 临时平移

- 在节点、Frame 与 surface 的 pointerdown 决策边界先判断临时平移，再执行选择/移动逻辑；
  临时平移统一捕获到 Stage surface。
- window keyup、window blur、pointercancel 和 lostpointercapture 都清理按键与进行中手势。
- 临时平移只请求 viewport 更新，不修改 selection、document 或 history。

## 风险/权衡

- 新共享包增加发布与依赖维护成本 → 包只承载 React Context、纯消息模板和语义 token，不吸收
  具体组件词典或业务状态。
- 完整浅色主题需要迁移多个包的硬编码色值 → 逐包改为共享 token，并用独立包组件测试和编辑器
  黄金图同时验证，删除 editor 的脆弱祖先覆盖。
- 全量第一方本地化容易误翻译宿主内容 → 只格式化稳定的内建 message ID，不修改 registry、
  Schema metadata 或宿主 ReactNode。
- 全局快捷键容易干扰文本编辑 → action 明确作用域，统一 editable/composing guard，并保留
  History 原有输入框内撤销行为。

## 迁移计划

1. 追加 Context 与模态设置 OpenSpec Scenario 及失败测试，保留首轮已通过的行为证据。
2. 新增共享包并迁移 Editor、Stage、SceneTree、History、CommandPanel 与 Palette。
3. 迁移 PropertyPanel、OperationLog 和基础材料 Inspector，再删除 editor 祖先主题覆盖。
4. 重构设置弹框、更新 E2E 与黄金图。默认值和兼容 locale 属性不变，宿主无需同步迁移。
