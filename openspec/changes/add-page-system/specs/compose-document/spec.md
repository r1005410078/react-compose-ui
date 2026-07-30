## ADDED Requirements

### Requirement: 页面文件约定

页面 MUST 以一份未经扩展的 `ComposeDocument v5` 持久化为名称以 `.page.json` 结尾的资源文件，
`ComposeDocument.schemaVersion` MUST 保持 5。`core` MUST 导出页面文件后缀常量、页面媒体类型
常量、文件名与显示名的双向转换，以及页面文档的解析与序列化。解析 MUST 拒绝非 v5 或结构不合法的
内容并返回可判别的 issue，MUST NOT 抛出未归一化的异常。

#### Scenario: 识别页面文件并取显示名

- **WHEN** 传入名称 `Home.page.json`
- **THEN** 判定为页面文件且显示名为 `Home`
- **AND** 由显示名 `Home` 反向生成的文件名等于 `Home.page.json`

#### Scenario: 拒绝非页面文件

- **WHEN** 传入名称 `Home.json` 或 `page.json.txt`
- **THEN** 判定为非页面文件
- **AND** 不产生副作用

#### Scenario: 解析非法页面内容

- **WHEN** 页面文件内容不是合法 JSON，或 `schemaVersion` 不等于 5
- **THEN** 解析返回描述原因的 issue
- **AND** 不返回文档

#### Scenario: 创建空白页面文档

- **WHEN** 请求创建一份空白页面文档
- **THEN** 得到 `schemaVersion` 为 5、`rootIds` 为空、带默认画布设置与默认输出设置的文档

### Requirement: 应用清单与首页指向

`core` MUST 定义资源根应用清单 `app.json`，其形状为 `{ schemaVersion: 1, homePageKey: string | null }`，
并 MUST 提供宽容解析与序列化。解析 MUST 在内容缺失、非法 JSON、结构不符或版本不支持时降级为
`homePageKey` 为 null 并返回可判别的 issue。序列化 MUST 原样写回解析时保留的未知顶层字段。
首页 MUST 由该清单唯一表达，页面文档自身 MUST NOT 携带首页标记。

#### Scenario: 清单缺失

- **WHEN** 资源根不存在 `app.json`
- **THEN** 解析结果的 `homePageKey` 为 null
- **AND** 不产生任何写入

#### Scenario: 清单损坏

- **WHEN** `app.json` 内容不是合法 JSON、结构不符或 `schemaVersion` 不受支持
- **THEN** 解析结果的 `homePageKey` 为 null 并附带对应 issue
- **AND** 既有文件内容不被覆盖

#### Scenario: 设首页保留宿主字段

- **WHEN** `app.json` 含有清单 Schema 之外的顶层字段，且首页被改写
- **THEN** 序列化结果包含新的 `homePageKey`
- **AND** 原有未知顶层字段被原样保留

### Requirement: 页面引用值与嵌套护栏

`core` MUST 定义页面引用值，其为可嵌入 `JsonObject` 的扁平字符串映射，包含 `kind` 为 `'page'`、
`providerId`、`assetKey` 与 `scope`。`core` MUST 提供从任意值读取页面引用的判别函数，以及基于
祖先页面链与深度上限判定嵌套状态的纯函数，结果 MUST 区分正常、循环引用与超出深度上限。

#### Scenario: 读取页面引用

- **WHEN** 传入含 `kind` 为 `'page'` 且字段完整的值
- **THEN** 返回该页面引用
- **AND** 传入 null、非对象或字段缺失的值时返回空结果

#### Scenario: 检出循环引用

- **WHEN** 待渲染页面的 key 已存在于祖先页面链中
- **THEN** 嵌套状态判定为循环引用

#### Scenario: 检出超出深度上限

- **WHEN** 当前嵌套深度已达到深度上限
- **THEN** 嵌套状态判定为超出深度上限
- **AND** 深度小于上限且无循环时判定为正常
