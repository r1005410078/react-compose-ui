## MODIFIED Requirements

### Requirement: 直接移动缩放与旋转

Stage MUST 使用 ready Layout Snapshot 渲染 Entity、选择 box 和 Overlay。Absolute Fixed Entity 的
move/resize/rotate MUST 继续一次手势最多提交一个命令；Flow 的编辑语义由后续变更定义。

#### Scenario: 使用同一 Snapshot 预览几何
- **WHEN** Auto Layout 改变嵌套 Entity 的 local box
- **THEN** DOM Scene、SVG Overlay、命中测试和 ruler 标记使用同一 resolved box
- **AND** Stage 不输出 CSS Flex 或把 resolved box 写入文档

## ADDED Requirements

### Requirement: Layout Runtime 状态界面

Stage MUST 接受可选 Layout Runtime；缺省时创建实例。loading 时 MUST 暴露 aria-busy 并禁止场景
交互，error 时 MUST 显示可访问错误，ready 时才挂载 Entity Scene。

#### Scenario: 异步进入 ready
- **WHEN** Stage 挂载后 Yoga loader 尚未完成再成功完成
- **THEN** 先显示布局加载态且不允许选择或变换
- **AND** ready 后使用当前文档的首个 Snapshot 一次性显示正确场景

