## MODIFIED Requirements

### Requirement: Headless 绘制会话

Engine MUST 在无 DOM 环境下维护绘制会话：拖拽期间只发布绘制预览，松手时至多请求一次
`drawing.commit`，MUST NOT 自行创建实体或铸造 ID——真正创建的是宿主。

绘制 MUST 由独立交互插件承担，且绘制工具下在空白或节点上按下都起笔：画布上已有内容不该挡住
继续作图。

绘制会话 MUST NOT 因并发的文档或布局变化中止——它只由世界坐标定义，不引用任何 Entity。退出
文字编辑时删除空文字会在同一次指针按下里改动文档，一并中止会让紧接着开始的绘制当场消失。
工具切换 MUST 中止绘制。

绘制点的约束（文字只按点创建、Shift 锁定正方形）MUST 只有一处实现，预览与提交共用；否则会
出现拖动时长出一个框、松手又缩回去的跳变。

#### Scenario: 松手才请求绘制提交

- **WHEN** 用户用矩形工具拖出一个区域并松手
- **THEN** 拖拽期间只发布预览，松手请求一次 `drawing.commit`

#### Scenario: 绘制中途的文档变化不打断手势

- **WHEN** 绘制手势进行中，文档因删除其他 Entity 而变化
- **THEN** 绘制手势保持进行，松手仍然请求一次 `drawing.commit`

#### Scenario: 工具切换中止绘制

- **WHEN** 绘制手势进行中工具切换为 select
- **THEN** 会话被取消，松手不请求任何提交

#### Scenario: 零尺寸按下不创建

- **WHEN** 用户用矩形工具按下后未移动即松手
- **THEN** 不请求提交

#### Scenario: 文字工具按点即创建

- **WHEN** 用户用文字工具按下后未移动即松手
- **THEN** 请求一次零尺寸的 `drawing.commit`
