## ADDED Requirements

### Requirement: 独立页面库包边界

系统 MUST 提供 `@compose-ui/library`：无 React、无 DOM 的页面库端口包，只依赖 `@compose-ui/core`
与 `@compose-ui/assets`。

它 MUST NOT 放进 `@compose-ui/pages`——那个包的边界是页面清单、聚合 Store 与运行时导航，而首页
是一个可以完全不加载编辑器的宿主；让它为一份业务目录把导航会话一起装上是多余的。

端口 MUST NOT 携带鉴权参数（token、用户标识）：鉴权属于 HTTP 适配器，放进端口会让本地实现凭空
多出一个它答不了的参数，而那个参数每一个调用点都要传。

错误 MUST 复用 `ComposeAssetError` 的六档分类，MUST NOT 另起一套同样六档的分类——那只会让消费方
把同一个 `switch` 写两遍。

#### Scenario: 库端口不依赖任何 React chrome

- **WHEN** 检查 `@compose-ui/library` 的依赖
- **THEN** 只出现 `@compose-ui/core` 与 `@compose-ui/assets`
- **AND** 公共 API 中不出现 React、DOM 事件或 HTMLElement

### Requirement: 库记录的性质与删除状态正交

库记录 MUST 用一个恒有的 `kind`（`project` | `template`）表达性质，用一个独立的 `deletedAt`
表达是否在回收站。回收站 MUST NOT 做成 `kind` 的第三个取值——一个模板被删除后恢复必须回到
「模板」，三元枚举把「恢复到哪儿」这件事从数据里擦掉了。

回收站视图 MUST 跨 `kind` 取 `deletedAt` 非空的记录。

软删除 MUST NOT 移动或删除页面文件。

#### Scenario: 删掉一个模板再恢复

- **WHEN** 一个 `kind: 'template'` 的记录被 trash 后 restore
- **THEN** 它回到模板，而不是项目
- **AND** 页面文件的资源条目 ID 与内容一个字节都没变

### Requirement: 场景类型是标签，未分类是标签为空

库记录 MUST 用一个标签 id 数组表达场景类型，MUST NOT 用固定枚举——固定枚举意味着新增一种场景
就要发版。

端口 MUST 提供一条**有序**的标签清单查询：那个顺序就是左栏的渲染顺序，不给顺序时两个宿主会排
出两种。

「未分类」MUST 由空数组表达，MUST NOT 是一个保留的标签 id——保留一个会造出「既打了未分类又打了
PCS」这个非法态，而且需要有人去维护它。

查询条件中的未分类 MUST 由 `null` 这一档表达，与标签 id 同在一个数组里：`null` 不可能与任何
标签 id 撞车，而数组形状让将来的多选是一次加法而不是一次破坏性变更。

#### Scenario: 只看未分类

- **WHEN** 查询条件的 categories 是 `[null]`
- **THEN** 返回的每一条记录的 categories 都是空数组

### Requirement: 一次查询回答整屏

`query()` MUST 在一次调用里返回列表、下一页游标与两组 facet 计数。分成两条调用 MUST NOT 接受
——用户改一次筛选就会看到计数是旧的、图是新的，而那个不一致屏幕上没有任何东西解释。

按场景类型的 facet MUST 在**摘掉 categories 这一项条件、保留其余条件（尤其是 search）**的前提下
求。不摘的话，选中某一类之后其余每一类都变成 0，左栏再也切不出去。

按去处的 facet（项目 / 模板 / 回收站）MUST 只受 search 影响，不受 kind、deleted、categories 影响
——它回答的是「切过去有多少」。

分页 MUST 用游标，MUST NOT 用 offset：图墙是滚动加载，而这个库正被多人同时写，offset 在并发写入
下会漏项与重项。

检索 MUST 只匹配标题，不匹配页面内容。

#### Scenario: 选中一个场景类型之后左栏仍可切换

- **WHEN** 查询条件含 `categories: ['pcs']`
- **THEN** 返回的 items 只有 PCS
- **AND** facet 里其余每个场景类型仍报出各自的真实计数，不是 0

#### Scenario: 搜索时三个去处的计数跟着变

- **WHEN** 查询带 search 且 `kind: 'project'`
- **THEN** byLocation 的三个数都按该 search 求出
- **AND** 模板与回收站那两个数不因为 `kind: 'project'` 变成 0

### Requirement: 新建与复制由端口一次完成

建一个页面同时要写页面文件与建库记录。端口 MUST 一次调用完成两者，MUST NOT 要求调用方顺序做
两步——中间失败会留下一个孤儿文件或一条孤儿记录，而它们都不可见。

以一条记录为底新建（「就用这个」）时，复制 MUST 在服务端完成，页面字节 MUST NOT 经过浏览器。

以一条记录为底新建出来的记录，性质 MUST 默认为 `project` 而不是继承来源：用户按下那一下的意思
是拿模板做一张要交付的图。

「被用作底稿的次数」MUST 只由这条复制操作在同一个事务里加一，端口 MUST NOT 提供任何可以单独
自增它的方法——那样打开一次就能刷，而这个数存在的全部理由是回答「哪个画法是大家在用的」。

#### Scenario: 从模板新建

- **WHEN** 调用方以一个 `template` 记录为底新建
- **THEN** 新记录的 kind 是 `project`
- **AND** 来源记录的使用次数加一
- **AND** 两件事在同一个事务里成立

### Requirement: 库端口不承担页面保存

编辑器保存页面 MUST 继续走 `ComposeAssetProvider.writeFile` 与它的 `expectedRevision` 乐观锁。
库端口 MUST NOT 提供第二条保存入口——同一件事的两个入口迟早写出两种行为。

库记录上的 revision 字段（若提供）MUST 只作缓存提示，MUST NOT 被用作乐观锁的比较值：乐观锁的
事实来源只有 `read()` 交回的那一个。

#### Scenario: 保存后首页排序跟着变

- **WHEN** 编辑器经资源端口保存了一份页面
- **THEN** 下一次库查询按修改时间排序时这一页排到前面
- **AND** 调用方没有为此调用任何库端口方法

### Requirement: 缩略图可以缺席，且不阻断保存

缩略图 MUST 由客户端渲染激活场景产出并上传，MUST NOT 要求服务端具备渲染能力。

上传 MUST 在保存成功之后异步进行，失败 MUST NOT 使保存失败。

库记录的缩略图 MUST 允许为空，消费方在为空时画占位。不经过编辑器的写入方（导入、接口直写）
因此不必产出缩略图。

#### Scenario: 缩略图上传失败

- **WHEN** 页面保存成功但缩略图上传失败
- **THEN** 页面已保存
- **AND** 该记录的缩略图为空，图墙画占位

### Requirement: 无后端时的 Provider 实现

系统 MUST 提供一个由 `ComposeAssetProvider` 支撑的库端口实现，使首页在没有后端时跑通完整流程。

Provider 答不了的业务字段 MUST 存在一份独立的库文件里；标题、修改时间与 revision MUST NOT 写进
那份文件——它们在资源条目上，存两份必然漂移。

库文件中**没有记录**的页面 MUST 按默认值出现在查询结果里（项目、无标签、使用次数 0），
MUST NOT 要求先注册：用户手动往目录里放一份页面文件，它照样要出现在库里。

#### Scenario: 手动放进目录的页面

- **WHEN** 目录里出现一份库文件中没有记录的页面文件
- **THEN** 查询结果里有它，性质是项目、没有标签、使用次数为 0
