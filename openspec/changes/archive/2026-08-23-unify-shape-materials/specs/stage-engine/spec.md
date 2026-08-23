# stage-engine 规范增量

## MODIFIED Requirements

### Requirement: 曲线点选按距离而不是包围盒

带 `Curve` 的 Entity 在 `entityAtPoint` 中 MUST 按点到线段的距离与容差判定命中，MUST NOT
按盒包含判定——一条对角线的盒里绝大部分是空的。距离判定 MUST 在 Entity 局部坐标进行，
使旋转后的命中自动正确。容差 MUST 从屏幕像素按 zoom 换算成世界单位。

该 Entity 有**可见填充**（`Appearance.backgroundPaint` 为不透明纯色）时，距离判定不中的点
MUST 再按「点是否落在几何内部」判定一次：填色区域是用户看见的墨，与 DOM 路径 MUST 给出同一
结论。没有填充时 MUST NOT 做这一步——空心图形的内部正是「盒里绝大部分是空的」覆盖的情形。

填充判定 MUST 读 `Appearance` 而不是 Renderer props：命中路径读的字段必须是文档级契约。

宽相位（bounds 映射、框选候选、裁剪判定）MUST 保持按盒不变。

#### Scenario: 点击线附近选中

- **WHEN** 在容差范围内点击一条对角线的线身
- **THEN** 该曲线 Entity 被命中

#### Scenario: 盒内空角不选中

- **WHEN** 点击对角线包围盒内远离线身的空角
- **THEN** 该曲线 Entity 不被命中

#### Scenario: 非 100% 缩放下容差正确

- **WHEN** 在 zoom ≠ 1 下以同样的屏幕距离点击线附近
- **THEN** 命中结果与 100% 缩放一致

#### Scenario: 旋转后命中跟随几何

- **WHEN** Entity 带非零 `Transform.rotation` 时点击旋转后的线身
- **THEN** 命中正确，点击旋转前的原位置不命中

#### Scenario: 填充过的闭合几何内部命中

- **WHEN** 一个带不透明填充的闭合多段线，点击它内部远离任何边的位置
- **THEN** 该 Entity 被命中

#### Scenario: 未填充的同一几何内部不命中

- **WHEN** 同一条闭合多段线没有填充，点击同一位置
- **THEN** 该 Entity 不被命中

## REMOVED Requirements

### Requirement: Headless 两点端点会话

**Reason**: 端点拖拽手势链（插件、`segment-endpoint` 命中类型、`segment.commit` 效果、
端点预览与手势阶段）随两点 Shape 的端点选区一起删除。它的输入类型是两个点，而步骤 10 的
顶点编辑要处理 N 个顶点与中点插入，接口本来就要重写。

**Migration**: 无文档影响。宿主若消费过 `segment.commit` 效果或 `segment-endpoint` 命中
类型，须随本次破坏性变更移除对应分支。
