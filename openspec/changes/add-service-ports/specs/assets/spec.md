## ADDED Requirements

### Requirement: assetKey 是不透明身份，不是存储路径

以对象存储为事实来源的 Provider MUST 把 `assetKey` 当作服务端签发的**不透明 id**，并以它
（而不是名称路径）作为对象存储里的 key。名称与父级 MUST 住在服务端自己的元数据里。

MUST NOT 把对象存储的路径直接当作 `assetKey`：协议已经要求 assetKey 在 rename/move 后保持不变，
而路径会跟着变——用户在资源浏览器里改一下文件夹名，图上每一个引用它的实例同时断掉，
且这个错误只在改名之后才出现，屏幕上没有任何东西解释它。

推论：rename 与 move MUST 只改元数据，MUST NOT 搬动对象。

目录 MUST 由元数据上的父级关系表达，MUST NOT 用对象前缀模拟——前缀表达不了空文件夹（前缀下
没有对象就等于它不存在），而资源浏览器允许建空文件夹。

#### Scenario: 重命名父文件夹后引用不断

- **WHEN** 一个被文档引用的文件所在的文件夹被重命名
- **THEN** 该文件的 assetKey 不变，文档中的引用仍解析到同一份内容
- **AND** 对象存储中没有发生任何字节搬运

### Requirement: 可选的直接资源 URL

协议 MUST 为「按 assetKey 取一个**可直接交给浏览器的 URL**」提供一条可选方法，返回 URL、
revision、媒体类型与失效时刻。该方法缺席时消费方 MUST 退回既有的 Blob 解析路径，既有 Provider
的行为因此逐字不变。

返回值 MUST 带失效时刻（除非该 URL 不过期）：签名 URL 会过期而一张图可能开着好几个小时，
不带它的症状是图在某一刻集体变成裂图。消费方 MUST 在失效前重取，并复用既有的失效重解路径。

#### Scenario: 缺席时退回 Blob

- **WHEN** Provider 未提供直接 URL 方法
- **THEN** 消费方按既有路径解析出 Blob 并自行管理 objectURL 生命周期

#### Scenario: URL 过期前重取

- **WHEN** 一个带失效时刻的资源 URL 即将过期而页面仍开着
- **THEN** 消费方在过期前重新解析，画面不出现裂图

### Requirement: 大文件直传与保存走两条路

协议 MUST 把新建大文件与改写已有文件分成两条路：新建大文件（导入的图纸、位图、字体）走一对
可选的「授权一次直传 + 回执」方法。

改写已有文件 MUST 继续走 `writeFile` 与它的 `expectedRevision`。判据是有没有乐观锁要守：
新建没有上一版可冲突，而保存一份页面有；把保存也改成直传要多一次回执握手才拿得到新 revision，
而页面文件本来就小。

`expectedRevision` MUST 映射成存储层的条件写入，冲突 MUST 归一成 `conflict` 错误码。

#### Scenario: 导入一份大图纸

- **WHEN** 用户导入一份几十 MB 的图纸而 Provider 提供直传
- **THEN** 字节直接进入对象存储，不经过业务服务
- **AND** 回执之后资源树里出现这个条目

#### Scenario: 并发保存同一页

- **WHEN** 两次保存携带同一个 expectedRevision
- **THEN** 后一次以 `conflict` 失败，先写的内容没有被悄悄覆盖
