## ADDED Requirements

### Requirement: 会话自报是否接管临时平移键

会话 MUST 能自行声明它把临时平移键（Space）重新解释为自己的修饰键——移动手势用它表达
「锁定原父级」而不是临时平移，两种意图不会同时出现，手势进行中也无法再按下第二个指针开始平移。

声明后内核 MUST 把
`temporary-pan.start` / `temporary-pan.end` 只转发给该会话，MUST NOT 再切换 `temporaryPan`
标志。内核 MUST NOT 按插件 id 列表做这个判断——那会把手势知识重新塞回内核，且每新增一个入口
都要改内核一次。

未声明的会话与空闲状态 MUST 保持既有行为：切换 `temporaryPan` 标志。

#### Scenario: 移动中按 Space 锁定原父级

- **WHEN** 移动手势进行中用户按下 Space
- **THEN** `temporaryPan` 标志不变，手势保持在移动阶段
- **AND** 落点立即重算，经过其他容器不再产生 reparent 落点

#### Scenario: 松开 Space 恢复落点

- **WHEN** 移动手势进行中松开 Space
- **THEN** 落点恢复，且会话不被当作平移取消

#### Scenario: 空闲时 Space 仍是临时平移

- **WHEN** 没有活动会话时用户按下 Space
- **THEN** `temporaryPan` 标志置位

## MODIFIED Requirements

### Requirement: 受约束变换 System

Stage Engine MUST 提供受约束的移动与缩放：轴向手柄把位移约束到单轴，缩放手柄按约束求解新几何，
两者都只在拖拽期间发布预览、松手时至多提交一条命令。

轴向移动手柄 MUST 由独立交互插件承担，并与其他移动入口共用同一个会话工厂——各入口只在**何时
接管**与是否带轴向约束上不同，接管之后的推进与提交完全一致。

命中轴向手柄但接管条件不成立时（工具已不是 move、选区没有可移动目标），插件 MUST 消费这次
按下而不是放行——手柄画在选区之上，放行会让它退化成一次自由拖动。

#### Scenario: 轴向手柄只改变一个轴

- **WHEN** move 工具下拖动 X 轴手柄并同时产生 Y 方向位移
- **THEN** 预览只沿 X 轴移动

#### Scenario: 工具已切换时手柄按下被消费

- **WHEN** 工具已不是 move，用户在残留的轴向手柄上按下
- **THEN** 本次按下被消费，不产生任何效果，也不开始自由拖动

#### Scenario: 并发变化中止轴向移动

- **WHEN** 轴向移动进行中 `document` 被别处的编辑替换
- **THEN** 会话被取消，松手不产生任何命令
