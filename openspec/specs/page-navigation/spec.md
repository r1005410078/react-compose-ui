# page-navigation Specification

## Purpose
TBD - created by archiving change add-page-navigation. Update Purpose after archive.
## Requirements
### Requirement: 无 React 的导航会话

`@compose-ui/pages` MUST 提供导航会话,实现 `core` 的 `ComposeNavigationPort`。会话 MUST 是
无 React、无 DOM 的纯模型,只依赖 `@compose-ui/core` 与 `@compose-ui/assets`。会话 MUST 持有
当前页面 key 与返回栈,并 MUST 允许订阅者在当前页面变化时收到通知。

会话 MUST NOT 自行渲染、加载文档或执行脚本;它只决定"当前应该是哪一页"。页面包装的读取
MUST 继续由既有的页面 Loader 承担。

#### Scenario: 在无 DOM 环境构造会话

- **WHEN** 在没有 DOM 与 React 的运行时中构造导航会话
- **THEN** 构造成功且可以完成跳转与返回
- **AND** 不引用任何浏览器全局对象

#### Scenario: 订阅当前页面变化

- **WHEN** 订阅者已注册且会话跳转到另一个页面
- **THEN** 订阅者收到通知且可读到新的当前页面 key
- **AND** 取消订阅后不再收到通知

### Requirement: 从首页起步

导航会话 MUST 以应用清单的 `homePageKey` 作为初始页面。`homePageKey` 为 null 时会话 MUST
以"无当前页面"的确定状态起步,并 MUST NOT 回退到目录中的任意一个页面。宿主 MAY 显式指定
一个初始页面覆盖首页。

#### Scenario: 按首页起步

- **WHEN** 清单的 `homePageKey` 指向一个存在的页面且会话被构造
- **THEN** 当前页面为该页面
- **AND** 返回栈为空

#### Scenario: 未设首页

- **WHEN** 清单的 `homePageKey` 为 null 且宿主未指定初始页面
- **THEN** 会话的当前页面为空且可被宿主区分于"加载中"
- **AND** 会话不猜测任何页面

### Requirement: 跳转与返回栈

按页面引用跳转 MUST 把当前页面推入返回栈并把目标设为当前页面。`navigateBack` MUST 弹出
返回栈的栈顶作为当前页面;返回栈为空时 MUST 是无副作用的 no-op 而不是错误。跳转到与当前
页面相同的目标 MUST 是 no-op,MUST NOT 向返回栈压入重复项。

返回栈 MUST 有明确上限,超出上限时 MUST 丢弃最旧的条目而不是无限增长。

#### Scenario: 跳转后返回

- **WHEN** 从 A 跳转到 B 再调用返回
- **THEN** 当前页面回到 A
- **AND** 返回栈为空

#### Scenario: 空栈返回

- **WHEN** 返回栈为空时调用返回
- **THEN** 当前页面不变且不产生错误

#### Scenario: 跳转到当前页面

- **WHEN** 跳转目标就是当前页面
- **THEN** 当前页面不变且返回栈不增长

### Requirement: 会话无需显式释放

导航会话 MUST NOT 暴露会使自身永久失效的释放入口。迟到的加载结果 MUST 由内部令牌挡掉，
订阅 MUST 由订阅方自己移除。宿主最自然的写法是「`useState` 创建 + effect cleanup 释放」，
而 React StrictMode 的挂载→清理→再挂载会让这样的会话在首次渲染后即永久失效，此后所有
跳转静默早退——一个只在开发模式出现、且没有任何报错的失败态。

#### Scenario: 反复挂载后跳转仍然可用

- **WHEN** 宿主在 StrictMode 下挂载消费该会话的渲染入口
- **THEN** 跳转与返回在双调用之后仍然生效

### Requirement: 会话起点重置

导航端口 MUST 提供把当前页面同步重置到指定页面的入口。重置 MUST NOT 验证目标、MUST NOT
进入返回栈，并 MUST 清空返回栈与上一次的失败说明——它表达的是"这次会话从这里开始"，
而不是一次跳转。宿主用它把预览起点对齐到用户正在编辑的页面：从首页起步会让用户打开预览
后看到的不是自己刚改的那一页。状态已经就位时重置 MUST NOT 发布快照。

#### Scenario: 重置到正在编辑的页面

- **WHEN** 会话已经跳转过若干次，宿主把它重置到另一个页面
- **THEN** 当前页面变为该页面且返回栈为空
- **AND** 不发生任何页面读取

#### Scenario: 重置清空失败说明

- **WHEN** 会话带着一条失败说明，宿主执行重置
- **THEN** 失败说明被清空

#### Scenario: 已经就位时不发布

- **WHEN** 当前页面已经是目标页面且返回栈为空、无失败说明
- **THEN** 重置不通知订阅者

### Requirement: 目标不可解析时的稳定失败

跳转目标在当前 Provider 中解析不到对应页面时,会话 MUST 停留在当前页面并发布可判别的
导航 issue,MUST NOT 把当前页面置空,也 MUST NOT 静默忽略这次跳转。目标页面存在但读取
失败时 MUST 同样保留当前页面并区分"目标不存在"与"读取失败"两种 issue。

#### Scenario: 目标页面已被删除

- **WHEN** 跳转目标的 `assetKey` 在当前目录中不存在
- **THEN** 当前页面保持不变
- **AND** 会话发布"目标不存在"的导航 issue

#### Scenario: 目标读取失败

- **WHEN** 目标页面存在但 Provider 读取抛出错误
- **THEN** 当前页面保持不变
- **AND** 会话发布可与"目标不存在"区分的读取失败 issue

