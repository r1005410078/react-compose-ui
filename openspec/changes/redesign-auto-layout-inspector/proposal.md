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
- 精简 LayoutItem 字段，重排 Flex 控件，并把 padding 编辑合并进紧凑盒模型实时预览。
- Grid 不进入本次 UI、文档协议、运行时或测试。

## 影响

- 受影响规范：`basic-materials`、`component-registry`、`property-panel`
- 受影响代码：Materials Container/Flex Inspector、Registry Inspector 协议、Editor Inspector 聚合、
  Property Panel Section、相关 E2E 与黄金图
- 兼容性：ComposeDocument v6 Schema 不变；已有 Layout 不在加载时自动修改
