## MODIFIED Requirements

### Requirement: 基于图层的安全降级取色

Engine MUST 命中最深、最上层、可见且未被裁剪排除的 Entity。普通采样返回点击局部点的 Solid/Gradient 颜色；Alt/Option 采样返回完整 backgroundPaint。无可求值 Paint 的 Entity 不得产生文档命令。

取色 MUST 由独立交互插件承担，其接管条件是宿主已启动采样，**与命中类型无关**——采样期间画布上
任何位置按下都是一次采样。采样几何计算 MUST 是接收文档与场景索引的纯函数，不依赖会话闭包。
采样目标变化时会话 MUST 结束。

#### Scenario: 采样被裁剪层与完整 Paint

- **WHEN** 用户在 Stage sample mode 点击被裁剪排除的层，或 Alt 点击可见 Gradient layer
- **THEN** 前者不会被采样，后者返回完整结构化 Paint
- **AND** 选择、viewport 和普通移动手势不改变

#### Scenario: 采样期间任何命中都触发采样

- **WHEN** 采样进行中用户在画布 chrome 或任意实体上按下
- **THEN** 本次按下作为采样处理，不落到该命中原本的手势

#### Scenario: 采样目标变化结束会话

- **WHEN** 采样会话进行中宿主把采样目标换成另一个 Entity 或另一个字段
- **THEN** 会话结束且不产生指向原目标的命令
