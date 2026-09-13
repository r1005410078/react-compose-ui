## MODIFIED Requirements

### Requirement: 可持久化编辑器画布设置

ComposeDocument v7 MUST 保存 grid 与 smartSnap。Grid stepX/stepY MUST 为有限正数，
offsetX/offsetY MUST 为有限数，primaryLineEvery MUST 为正整数。`canvas` MUST NOT 保存
guides——辅助线归属 Frame。`canvas` 是编辑器视口设置，MUST NOT 承载任何内容语义。

默认步长 MUST 是 4：它是界面设计通行的基础模数，而 8 是它的倍数，因此改默认值 MUST NOT 把
任何按旧默认值排过的点挪离格点。

#### Scenario: 创建默认画布设置

- **WHEN** 宿主调用 `createDefaultCanvasSettings`
- **THEN** 得到 4×4、零偏移、每 4 格主线且三类吸附开启的独立 JSON
- **AND** 结果不包含 guides 字段且多次调用不共享可变对象

#### Scenario: 保存全局辅助线

- **WHEN** 文档需要保存辅助线
- **THEN** 辅助线 MUST 保存在所属 Frame 的 `Frame.guides` 上，位置以该 Frame 原点为参照
- **AND** `canvas.guides` 不再存在；带该字段的文档被拒绝而不是静默丢弃

#### Scenario: 拒绝非法画布配置

- **WHEN** canvas 缺失、grid 数值非法、主线间隔不是正整数，或 canvas 仍包含 guides 字段
- **THEN** 校验返回稳定 issue code 和 canvas 字段 path
- **AND** 不返回经过静默修正的文档
