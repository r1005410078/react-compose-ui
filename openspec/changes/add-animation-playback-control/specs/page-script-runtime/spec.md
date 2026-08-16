## ADDED Requirements

### Requirement: 动画播放控制的脚本驱动语义

绑定到页面 setup 导出的动画播放控制 MUST 遵守以下语义。`playing` 绑定 MUST 读取布尔导出：
从 `false` 变为 `true` 的上升沿 MUST 先把播放头复位到 `0` 再按动画的 `playbackMode` 推进；
从 `true` 变为 `false` MUST 停止推进并把播放头停在当前帧。`currentTime` 绑定 MUST 读取数值导出，
存在时脚本完全接管时间轴：播放头 MUST 等于该导出的值钳制到 `[0, durationMs]`，
运行时 MUST NOT 自行推进，`playing` 与 `playbackMode` MUST 被忽略。
订阅 MUST 使用 `subscribeExport` 的单导出粒度，MUST NOT 订阅整个作用域。

#### Scenario: 上升沿从头播放

- **WHEN** 绑定的布尔导出从 `false` 变为 `true`
- **THEN** 播放头复位到 `0` 并开始推进

#### Scenario: 重新触发可重播

- **WHEN** 一条 `play-once` 动画播放到末尾后，绑定的布尔导出被置为 `false` 再置为 `true`
- **THEN** 动画从 `0` 重新播放一次

#### Scenario: 下降沿停在当前帧

- **WHEN** 动画播到 180 ms 时绑定的布尔导出变为 `false`
- **THEN** 推进停止，画面保持在 180 ms 的采样结果

#### Scenario: 脚本接管时间轴

- **WHEN** 动画绑定了 `currentTime` 且该数值导出的值为 150
- **THEN** 播放头为 150 ms，运行时不自行推进
- **AND** 即使 `playing` 也有绑定且为 `true`，也不改变这一行为

#### Scenario: 当前时间越界被钳制

- **WHEN** 绑定的数值导出给出负数或大于 `durationMs` 的值
- **THEN** 播放头钳制到 `0` 或 `durationMs`

### Requirement: 播放控制绑定的失效处理

绑定的导出不存在、已被脚本热重载移除，或类型与目标语义不符时，运行时 MUST 按未绑定处理，
MUST NOT 抛出异常或猜测类型转换，并 MUST 通过 `reportDiagnostic` 报告一条可定位的诊断。
运行时 MUST NOT 因为绑定失效而修改文档中已保存的绑定。

#### Scenario: 绑定到不存在的导出

- **WHEN** `bindings.playing` 指向一个页面 setup 没有导出的名称
- **THEN** 动画不播放，页面正常渲染，并产生一条诊断

#### Scenario: 类型不匹配

- **WHEN** `bindings.playing` 指向一个字符串导出
- **THEN** 动画不播放，不做真值转换，并产生一条诊断

#### Scenario: 热重载后导出消失不清除绑定

- **WHEN** 用户编辑 setup 脚本删掉了被绑定的导出
- **THEN** 文档中的绑定保持不变，只产生诊断
- **WHEN** 用户把该导出改回来
- **THEN** 动画恢复受控，不需要重新绑定
