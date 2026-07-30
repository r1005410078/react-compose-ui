## MODIFIED Requirements

### Requirement: 资源 Canvas 拖拽意图

Asset Browser MUST 从文件树和目录网格发出普通数据的 start/move/end/cancel Canvas 拖拽事件，
且 MUST NOT 依赖 Stage、Core 或 ComposeDocument。内建可拖拽范围为受支持图片，宿主 MUST 能通过
判定回调放宽该范围；该回调只对已满足可引用能力、文件类型与稳定资源 key 的条目调用。只要产出
可拖拽条目，拖拽 MUST 写入始终填充的稳定引用载荷，其内容为带版本号的引用条目集合；既有的内部
移动 id 载荷语义保持不变。

#### Scenario: 拖动单项或多项图片

- **WHEN** 用户拖动 SVG 或受支持位图，且当前多选包含其他兼容图片
- **THEN** start 事件按选择顺序包含兼容且可引用的文件
- **AND** 脚本、目录与不支持文件被排除

#### Scenario: 资源内部移动不创建节点

- **WHEN** 同一拖拽落到 Asset Browser 内的合法目录
- **THEN** Provider move 正常执行
- **AND** Canvas 生命周期以 cancel 结束

#### Scenario: 宿主放宽可拖拽范围

- **WHEN** 宿主通过判定回调接受某类非图片文件，用户拖动该文件
- **THEN** start 事件包含该文件
- **AND** 未被接受的文件仍被排除

#### Scenario: 写入稳定引用载荷

- **WHEN** 拖拽产出至少一个可拖拽条目
- **THEN** 拖拽数据包含带版本号的稳定引用载荷
- **AND** 该载荷在条目不可移动时同样被写入
- **AND** 内部移动 id 载荷仍只包含可移动条目
