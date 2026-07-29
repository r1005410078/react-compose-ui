## ADDED Requirements

### Requirement: 无 DOM Paint 编辑与图层采样会话

StageInteractionController MUST 通过普通数据 context、event、snapshot 和 effect 支持 Paint edit 与 sample；不得导入 React、DOM、Registry 或 Renderer。编辑仅限当前单选 target，pointer move 只产生 preview，pointer up 最多产生一个命令；取消和不兼容 context 更新不提交。

#### Scenario: 拖动旋转 Entity 的渐变 stop

- **WHEN** 用户拖动旋转或嵌套 Entity 的渐变控制柄
- **THEN** Engine 以逆世界矩阵换算局部 Paint 坐标并发布 preview
- **AND** pointer up 只提交一次完整 Paint

### Requirement: 基于图层的安全降级取色

Engine MUST 命中最深、最上层、可见且未被裁剪排除的 Entity。普通采样返回点击局部点的 Solid/Gradient 颜色；Alt/Option 采样返回完整 backgroundPaint。无可求值 Paint 的 Entity 不得产生文档命令。

#### Scenario: 采样被裁剪层与完整 Paint

- **WHEN** 用户在 Stage sample mode 点击被裁剪排除的层，或 Alt 点击可见 Gradient layer
- **THEN** 前者不会被采样，后者返回完整结构化 Paint
- **AND** 选择、viewport 和普通移动手势不改变
