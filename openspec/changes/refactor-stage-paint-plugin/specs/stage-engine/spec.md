## MODIFIED Requirements

### Requirement: 无 DOM Paint 编辑与图层采样会话

Engine MUST 在无 DOM 环境下维护 Paint 控制柄拖拽与图层采样会话，移动期间只发布 preview，
松手时至多请求一条 Appearance 命令。

Paint 控制柄拖拽 MUST 由独立交互插件承担。命中控制柄但接管条件不成立时（宿主未打开该 Entity
的 Paint 编辑、选区不止一个、选区不是该 Entity、目标被锁定），插件 MUST 消费这次按下而不是
放行——控制柄压在 Entity 自身之上，放行会让它退化成一次移动手势。

世界坐标到 Paint 归一化局部坐标的换算 MUST 只有一处实现，供控制柄拖拽与图层采样共用。

#### Scenario: 渐变控制柄只 preview

- **WHEN** 用户拖动线性渐变端点控制柄
- **THEN** Engine 以逆世界矩阵换算局部 Paint 坐标并发布 preview
- **AND** 松手时请求一条 setAppearance 命令

#### Scenario: 锁定目标上的控制柄按下不退化成移动

- **WHEN** Paint 编辑打开但目标已被锁定，用户在控制柄上按下
- **THEN** 本次按下被消费，不产生任何效果，也不开始移动手势

#### Scenario: 并发文档变化中止渐变拖拽

- **WHEN** 渐变拖拽进行中，`document` 被别处的编辑替换
- **THEN** 会话被取消，松手不产生任何命令

#### Scenario: 编辑目标或选区变化结束会话

- **WHEN** 渐变拖拽进行中，宿主关闭 Paint 编辑或选区不再恰好是该 Entity
- **THEN** 会话被取消，不产生命令
