## ADDED Requirements

### Requirement: 曲线点选按距离而不是包围盒

带 `Curve` 的 Entity 在 `entityAtPoint` 中 MUST 按点到线段的距离与容差判定命中，MUST NOT
按盒包含判定——一条对角线的盒里绝大部分是空的。距离判定 MUST 在 Entity 局部坐标进行，
使旋转后的命中自动正确。容差 MUST 从屏幕像素按 zoom 换算成世界单位。

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
