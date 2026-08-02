## RENAMED Requirements

- FROM: `### Requirement: Flex 布局 Component 与紧凑 Inspector`
- TO: `### Requirement: 紧凑 Auto Layout Inspector`

## REMOVED Requirements

### Requirement: Layout Inspector 轻量预览

**Reason**: Layout Runtime 上线后 Stage 与独立 Preview 会按 Layout 真实排布，该需求
「预览只属于 Inspector、Stage 与 Preview 必须忽略 Layout」的约束不再成立。预览行为并入
「紧凑 Auto Layout Inspector」的 wrap 预览 Scenario。

## ADDED Requirements

### Requirement: Auto Layout 按需启用

新建 Container 与“容器”能力 MUST 默认创建自由 Hierarchy 而不创建 Layout。拥有 Hierarchy 且缺少
Layout 的 Inspector MUST 提供“布局 +”菜单；菜单当前 MUST 只包含 Auto Layout，不得显示 Grid。

#### Scenario: 创建默认自由 Container

- **WHEN** Registry 从 Container Preset 创建 Entity，或给 Renderer 添加“容器”能力
- **THEN** Entity 拥有 Hierarchy 与 Clip 但不拥有 Layout
- **AND** 直接子项只能使用 Absolute

#### Scenario: 添加 Auto Layout

- **WHEN** 用户从“布局 +”菜单选择 Auto Layout
- **THEN** 系统在一个事务中添加默认 Flex Layout 并按 childIds 将全部直接子项转为 Flow
- **AND** 子项顺序、尺寸意图、margin、alignSelf 与旧 offset 保持不变

#### Scenario: 展开未启用布局引导

- **WHEN** 拥有 Hierarchy 且缺少 Layout 的 Entity 展开“布局”分组
- **THEN** Inspector 紧凑显示 Auto Layout 图示、“使用自动布局”、用途说明、“添加自动布局”操作
  和“添加后可随时移除”辅助文案
- **AND** 标题栏加号继续打开布局类型菜单，正文添加操作直接启用 Auto Layout
- **AND** 两个入口使用同一原子添加规划，锁定或缺少文档时均保持禁用

#### Scenario: 锁定目标阻止添加

- **WHEN** 容器或任一需要转为 Flow 的直接子项已锁定
- **THEN** Auto Layout 添加入口禁用并提供可读原因
- **AND** 文档、历史与 Operation Log 均不变化

#### Scenario: 移除 Auto Layout 保持视觉

- **WHEN** 用户移除一个 Snapshot 完整的 Auto Layout
- **THEN** 直接 Flow 子项按当前 local box 烘焙为 Absolute，Fill 轴转为 Fixed
- **AND** 容器自身 Hug 轴转为 Fixed，Absolute 子项与嵌套 Layout 保持不变
- **AND** 整个操作只提交一个事务

#### Scenario: 无可靠 Snapshot 时禁止移除

- **WHEN** LayoutSnapshot 未就绪或缺少容器或 Flow 子项的必要 box
- **THEN** 移除入口禁用并说明需要等待布局计算
- **AND** 系统不使用旧 offset 或 fallback 尺寸降级

#### Scenario: 旧基础 Layout 主动解除归属

- **WHEN** 旧 v6 Entity 的 Composition.baseComponentKeys 仍包含 Layout 且用户主动移除布局
- **THEN** 同一事务先解除 Layout 的基础归属再移除 Component
- **AND** 加载旧文档本身不会修改任何 JSON

## MODIFIED Requirements

### Requirement: 紧凑 Auto Layout Inspector

Materials MUST 根据 LayoutItem 当前语义隐藏无效字段，把 Identity、Transform 与 LayoutItem 作为
单列“基础”分组呈现，并在约 400px Inspector 中以三行 Flex 控件和紧凑盒模型预览编辑布局。
基础分组 MUST 不显示 CSS 副标题；Auto Layout 分组的图标数量、语义顺序、键盘与 ARIA MUST 与
浏览器 Flex 控件一致。

#### Scenario: 按定位和尺寸模式显示字段

- **WHEN** LayoutItem 在 Absolute/Flow 或 Fixed/Fill/Hug 之间切换
- **THEN** Inspector 不显示 Flow/Absolute 定位模式，Absolute 显示位置且隐藏自身对齐，Flow 执行相反规则
- **AND** 名称、位置或自身对齐、旋转、尺寸、外边距各占一行并位于同一基础分组
- **AND** Absolute 的位置行显示 X/Y，Flow 在对应行显示自身对齐，旋转始终使用独立 Angle 属性行
- **AND** 尺寸行并排显示 W/H，Fixed 只显示可编辑数字，Fill/Hug 分别显示英文 `Fill`/`Hug`
- **AND** 基础分组不显示 position、width、height、inset、margin 或 align-self 等 CSS 副标题

#### Scenario: 编辑宽高智能输入

- **WHEN** 用户聚焦尺寸字段、输入合法数字或英文 Fill/Hug，或从建议列表选择模式
- **THEN** 数字输入原子写入 Fixed，英文模式输入或建议选择原子写入对应模式
- **AND** 每个轴只显示 W/H 前缀与一个输入框，不常驻显示 Fixed 文案、尾部 select 或模式箭头
- **AND** 聚焦时出现的建议列表只包含当前上下文允许的 `Fill`/`Hug`，中文界面也不得翻译这些模式名
- **AND** 模式文本匹配大小写不敏感，最终显示规范化为 `Fill`/`Hug`
- **AND** 空白、非法输入或 Escape 不产生事务，Enter 与失焦只提交一次有效值

#### Scenario: 编辑独立位置与角度属性

- **WHEN** 用户编辑 Absolute 的位置、Flow 的自身对齐，或独立旋转属性
- **THEN** Inspector 分别通过现有 LayoutItem 或 Transform 命令更新对应 Component
- **AND** Absolute 位置使用独立 Position 自定义类型、Flow 自身对齐使用独立 picklist、旋转使用内建 angle 语义类型
- **AND** Materials 不把 position、alignSelf 与 rotation 包含在同一个自定义值中
- **AND** 数值草稿只在 Enter 或失焦时提交，Escape、空白与非法值不产生事务

#### Scenario: 展开和联动外边距

- **WHEN** 四边外边距相等或用户展开、分别编辑并重新联动四边
- **THEN** 相等值默认显示单值和展开按钮，非等值保持 T/R/B/L 展开状态
- **AND** 重新联动以 top 统一四边且只提交一次事务

#### Scenario: 编辑统一或分轴 gap

- **WHEN** rowGap 与 columnGap 相等或用户选择分轴编辑
- **THEN** Inspector 分别显示单值 gap 或 row-gap/column-gap
- **AND** 单值提交同步两轴，重新合并时以 rowGap 统一两轴且只提交一次事务

#### Scenario: align-content 始终可配置

- **WHEN** flex-wrap 为 nowrap
- **THEN** align-content 仍显示完整六项并可提前配置
- **AND** Inspector 提示该属性仅在产生多行时影响结果

#### Scenario: 再次点击已选 Flex 选项恢复默认

- **WHEN** 用户再次点击 direction、wrap、align-content、justify-content 或 align-items 中当前已选的非默认选项
- **THEN** Inspector 将该属性恢复为 ComposeDocument 支持的显式 CSS 初始等价值
- **AND** 分别使用 row、nowrap、stretch、flex-start 与 stretch，不写入空值或 normal
- **AND** 当前已是显式默认项时再次点击保持幂等且默认项继续显示为选中
- **AND** 显式默认项使用中性弱选中样式，非默认选择才使用强调蓝色

#### Scenario: 在独立属性中编辑 padding

- **WHEN** 用户在独立内边距属性中编辑单值，或展开后分别修改四边 padding
- **THEN** Layout.padding 通过一次提交更新，且单值、四边展开与联动交互均与基础外边距相同
- **AND** 内边距字段使用与其他 Auto Layout 属性一致的上下结构，显示“内边距”和 `padding` CSS 副标题
- **AND** 四值相等时默认显示单值和展开按钮，非等值保持 T/R/B/L 展开，重新联动时以 top 统一四边
- **AND** 实时预览不包含 padding 输入框、联动按钮或其他可编辑控件

#### Scenario: wrap 预览展示多行对齐

- **WHEN** 用户选择 wrap 或 wrap-reverse 并修改 align-content
- **THEN** 预览以三个模拟子项生成至少两行并实时展示对应多行对齐
- **AND** 预览显式显示随 flex-direction 改变的主轴和交叉轴指示
- **AND** Stage、Preview 和正式 LayoutSnapshot 不读取该 Inspector DOM
- **AND** 三个模拟子项使用无渐变、低对比的扁平样式，与可操作的蓝色选中控件保持清晰层级

#### Scenario: 窄侧栏保持完整可操作

- **WHEN** Inspector 内容宽度约为 365px
- **THEN** direction/wrap、gap/align-content、justify-content/align-items 三行均无横向溢出
- **AND** 两列使用紧凑间距，不产生无用途的中央空白带
- **AND** 基础分组的位置/自身对齐、独立旋转、智能尺寸输入、展开外边距、独立内边距、建议列表、焦点环和英文文案保持可达与可读
