## ADDED Requirements

### Requirement: 导线落地使用导线 Preset

`WIRE` 命令提交时，Stage MUST 按提交效果上的 `wire` 标记从 Registry 取 `wire` Preset 的
seed，而 MUST NOT 取 `curve` Preset 再在落地处覆写描边 props。这与 `ARROW` 按 `arrow` 标记
取 `arrow` Preset 是同一条既有边界：描边默认住在物料包里，Stage 认识 Preset id 就够了，
MUST NOT 也认识 prop 名——否则换默认色要同时改两个包，而漏改的那一处不会有任何报错。

`wire` Preset 缺失时 MUST 与其余 Preset 缺失时行为一致（不产生命令），MUST NOT 静默回退到
`curve`：回退会画出一条看起来是标注线的导线，而它是主回路、而且带着屏幕上看不见的绑定。

#### Scenario: 画出的导线是粗实线

- **WHEN** 用 `WIRE` 命令取两个点
- **THEN** 新 Entity 的 `Composition.presetId` 是 `wire`
- **AND** 它的 `strokeWidth` 大于同样两点画出的 `LINE`

#### Scenario: LINE 仍用普通曲线 Preset

- **WHEN** 用 `LINE` 命令画一段，即使端点吸附到了某个端口上
- **THEN** 新 Entity 的 `Composition.presetId` 是 `curve`
