## ADDED Requirements

### Requirement: 命令行提示可键入的命令

`ComposeCommandLine` MUST 提供可选的 `completions`：一组 `ComposeCommandDescriptor`。给出它时，
没有活动提示且缓冲非空时组件 MUST 列出匹配的命令；缓冲以 `/` 开头时 MUST 列出全部
（`/` 之后的文本只用来过滤）。有活动提示时 MUST NOT 提示——那时缓冲里是坐标与关键字。
空缓冲 MUST NOT 提示：那时 `Enter` 是「重复上一条」、方向键是召回历史。

匹配 MUST 按三档排序：名称或别名**整词**命中在前，名称或别名**前缀**次之，显示名或检索词
**包含**最末；同档 MUST 保持词汇表次序。整词那一档决定 `Enter` 的含义——少了它，敲 `C`
回车会得到按序排在 `CIRCLE` 前面的某个 `C` 开头的命令，等于加上补全改掉了每一个别名的
解析结果。匹配 MUST 是 `components` 里的纯函数（`matchComposeCommandCompletions`）。

给出 `completions` 时输入框 MUST 是 WAI-ARIA combobox：列表是 listbox，高亮项经
`aria-activedescendant` 关联，焦点 MUST NOT 离开输入框。方向键 MUST 移动高亮，`Enter` MUST
提交高亮那条的 `id`（与用户亲手敲出全名走同一条提交路径），`Tab` MUST 把它填进缓冲而不提交，
列表开着时 `Escape` MUST 只清空缓冲、收起列表，MUST NOT 上报取消。点一条 MUST 与提交它的
`id` 等价。

不可用的命令（`disabledReason` 非空）MUST 照样列出并标明原因，MUST NOT 藏起来——藏起来与
「这个词不存在」无法区分。

不给出 `completions` 时输入框 MUST 仍是普通 textbox，MUST NOT 渲染列表。组件仍 MUST NOT 认识
任何具体命令：它只读描述符上可呈现的那半边。列表的可访问名称 MUST 由 `messages.completionsLabel`
注入。

#### Scenario: 敲 / 列出全部

- **WHEN** 传入词汇表，用户键入 `/`
- **THEN** 列出全部命令，第一条高亮，不可用的带原因

#### Scenario: 前缀提示与回车启动

- **WHEN** 用户键入 `co`，词汇表里有 `COPY` 与别名为 `C` 的 `CIRCLE`
- **THEN** 只列出 `COPY`，回车上报 `COPY`

#### Scenario: 整词别名优先

- **WHEN** 用户键入 `C` 后回车
- **THEN** 上报 `CIRCLE` 而不是 `COPY`

#### Scenario: 两级 Escape

- **WHEN** 列表开着时用户按 `Escape`
- **THEN** 列表收起、缓冲清空，不上报取消；再按一次才上报取消

#### Scenario: 命令进行中不提示

- **WHEN** 有活动提示，用户键入与某条命令同名的关键字
- **THEN** 不渲染列表

#### Scenario: 没有词汇表

- **WHEN** 没有传入 `completions`，用户键入 `/`
- **THEN** 输入框是 textbox，不渲染列表
