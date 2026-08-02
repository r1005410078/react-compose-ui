# 变更：Auto Layout 按需启用与 Inspector 一体化改造

## 原因

Container 当前默认携带 Layout，用户无法先创建自由容器再明确选择布局方式；同时布局项、Flex
设置和实时预览存在无效字段、重复 padding 入口与侧栏密度问题。需要把布局模式入口与属性编辑
整合为一条明确、可逆且由 LayoutSnapshot 保证视觉稳定的流程。

## 变更内容

- 新建 Container 与“容器”能力默认不再携带 Layout；缺失 Layout 时显示“布局 +”入口。
- 选择“自动布局”时原子添加 Flex Layout 并把直接子项转为 Flow；移除时按 Snapshot 烘焙为
  Absolute，保持当前视觉。
- 增加 Registry 缺失 Component Inspector 协议和 Property Panel action-only 分组。
- 增加 Registry Inspector 基础分组与默认展开协议，把 Identity 与跨 Transform/LayoutItem 的复合
  几何 Inspector 合并为单列“基础”分组，并让同一 Section 中的多个 Inspector 共享正确的搜索可见性。
- 隐藏定位模式，把位置/自身对齐、旋转、尺寸拆成各自独立的属性类型和标准属性行；旋转复用
  Property Panel 内建 Angle Editor，尺寸则以 W/H 两个可输入数字或英文 `Fill`/`Hug` 的单一
  combobox 呈现，不常驻显示尾部模式选项。
- 保留可展开四边的紧凑外边距入口；基础分组不再显示 CSS 副标题。
- 在共享 Components 层发布通用角度选择器，为基础 Angle Editor 与 Materials 旋转入口提供同一套
  数字输入、转盘、快捷角、键盘和焦点语义。
- 重排 Flex 控件；padding 使用与基础外边距一致的单值/四边展开属性，实时预览恢复为独立只读展示。
- Grid 不进入本次 UI、文档协议、运行时或测试。

## 影响

- 受影响规范：`basic-materials`、`component-registry`、`components`、`property-panel`
- 受影响代码：Materials Container/Flex Inspector、Registry Inspector 协议、Editor Inspector 聚合、
  Property Panel Section、相关 E2E 与黄金图
- 兼容性：ComposeDocument v6 Schema 不变；已有 Layout 不在加载时自动修改
