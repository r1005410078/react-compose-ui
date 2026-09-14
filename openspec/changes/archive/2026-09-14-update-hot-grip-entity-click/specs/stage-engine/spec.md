## ADDED Requirements

### Requirement: 取点效果携带命中

绘图取点插件交给宿主的 `drafting.point` 效果 MUST 携带这次按下的命中（`hit`），与世界坐标并列。
引擎在任何命中类型上都接管取点，但「按在谁身上」只有持有会话的宿主才用得上——热夹点下按在别的
Entity 上是换对象还是取点，由宿主按捕捉结果判定。

#### Scenario: 效果带上命中

- **WHEN** 命令正在等一个点，用户在一个 Entity 上按下
- **THEN** `drafting.point` 效果的 `hit` 是那个 Entity 的命中，`point` 是按下的世界坐标
