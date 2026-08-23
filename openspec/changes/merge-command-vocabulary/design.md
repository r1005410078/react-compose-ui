# 设计：命令词汇表合并

## 1. 为什么是 `Definition` 吞并 `Action`，而不是反过来

`Action` 表达不了多步。`Definition` 表达得了一步——`prompt` 为 `null` 的会话收到确认就提交，
这一档**已经存在**（`ERASE` 预选时走的就是它，注释里写着「先选好对象再敲 `E↵`，对象当场就
删」）。方向因此是单向的：能表达多的那个吞并能表达少的那个，代价是 0；反过来要把八条会话
命令的状态机塞进 `run()`，做不到。

`Action` 并未整条消失：它的**呈现半边**（是什么、属于哪个能力、此刻能不能跑）上升成
`ComposeCommandDescriptor` 供两者共用，剩下的 `run()` 退化成「请求启动这条命令」。

## 2. 描述符与定义分家，因为读它的人不都能跑它

```ts
interface ComposeCommandDescriptor {
  readonly id: string
  readonly aliases?: readonly string[]
  readonly title: string
  readonly category?: string
  readonly keywords?: readonly string[]
  readonly shortcut?: readonly ComposeKeybinding[]
  readonly disabledReason?: string
}
interface ComposeCommandDefinition<TContext, TEffect> extends ComposeCommandDescriptor {
  start(context: TContext): ComposeCommandSession<TEffect>
}
```

分家的理由是 `TContext` / `TEffect`：命令面板只需要**列出与检索**，让它跟着泛型走会把两个
它永远不使用的类型参数传染到整个面板 API 上。描述符没有泛型，因此「谁能列出命令」与「谁能
跑命令」是两个不同的门槛——这正是本刀的 Non-Goal（面板不跑画布会话）在类型上的体现。

`shortcut` 放进描述符而不是留在面板：`ComposeKeybinding` 本来就定义在 `commands` 里
（AGENTS.md：本包是它的唯一定义处），放在这里不引入任何新依赖。

## 3. 上下文不硬合并，依赖在注册时闭包捕获

`StageDraftingContext` 保持 `{ messages, selection? }`。编辑器动作要的 `document`、
`dispatch`、`idFactory`、`setSelectedIds` 全部在建目录时闭包捕获：

```ts
createComposeImmediateCommand({
  id: 'edit.group', aliases: ['GROUP'], title, category,
  disabledReason,
  run: () => handlers['edit.group'].run(),   // handlers 已闭包捕获 context
})
```

反例是把上下文并成两者的并集。那样每加一条命令就往上下文里加一个字段，而绝大多数命令用不到
它；更要命的是 `commands` 是零运行时依赖包，上下文一旦携带文档类型，这条边界就没了。

代价是**目录必须随上下文重建**——选择集一变，`disabledReason` 就得重算。目录本来就是每次
渲染按 `useMemo` 重建的（今天的 `createComposeEditorActions` 已经如此），所以这不是新代价。

## 4. 可用性是描述符的字段，不是注册表的查询

两个选项：`registry.isAvailable(id)` 与 `descriptor.disabledReason`。选后者。

理由是**面板与命令行必须给出同一个答案**，而面板拿到的是一个列表、不是注册表。把可用性做成
注册表方法，面板要么再持有一份注册表，要么自己判断——两条都会漂移。字段随描述符走，一份数据
两处呈现。

`disabledReason` 是**已本地化的文案**而不是稳定标识，与既有 `ComposeCommandAction` 一致：
编辑器内部仍用 `ComposeEditorActionDisabledKey` 这个稳定键，翻译发生在呈现层（现有的
`createComposeEditorActions` 那一步）。`commands` 不认识 locale，让它认识就要把 i18n 拖进
一个零依赖包。

## 5. 命令行拒绝的三种，必须互相可分

| 情形 | 命令行显示 |
| --- | --- |
| 词不在注册表里 | 未知命令 |
| 词在注册表里但此刻不可用 | 该命令的 `disabledReason` |
| 会话进行中的非法输入 | 会话给的 `rejected.message`（既有） |

第二种是本刀新增的。没有它，敲 `GROUP` 而没选够对象会**什么都不发生**，与敲错字在屏幕上无法
区分——而这正是「可用性标记」这条要挡的失败。

## 6. 命令历史分两处：组件记文本行，宿主记命令

| | 住在哪 | 记什么 | 为什么 |
| --- | --- | --- | --- |
| 上箭头召回 | `ComposeCommandLine` | 提交过的**文本行** | 组件拥有输入框；「召回我敲过的字」没有任何业务语义，是终端的通用行为 |
| 空 Enter 重复 | `useStageDrafting` | 上一条**成功启动的命令** | 需要分辨空闲与会话进行中（进行中空 Enter 是 `accept`），也需要分辨「命令名」与「坐标行」——后者不是命令 |

两者记的**不是同一个序列**：键入 `LINE↵ 10,10↵ 40,40↵` 之后，上箭头依次召回三行文本，而空
Enter 重的是 `LINE`。做成一个的话，空 Enter 会把 `40,40` 当命令名去解析。

与 `operation-log` 划清界限：那里记的是**文档变了什么**（事务），这里记的是**我敲了什么**。
一条命令可能产生零条事务（`LINE` 只取了一个点就结束）或多条（`LINE` 连画三段）。

上箭头默认会把光标移到行首，因此要 `preventDefault`——这是终端的既有约定，不是新发明。

## 7. 别名不本地化

`title` 本地化，`id` 与 `aliases` 不。它们是用户**键入的标识**，与 `LINE`、`MOVE` 同类；
本地化会让同一条命令在中英文界面下敲法不同，而用户的肌肉记忆、文档与截图全都会失效。
AutoCAD 的本地化版本正是靠 `_LINE` 这个下划线前缀保住英文名的。

## 8. 别名只给「用户会去敲的那些」，而这一步暴露了两处重复

机械地给 31 条动作各造一个别名会造出 `SELECTTOOL` 这种没人会敲的词。按「用户会不会敲」来给，
剩下的仍可用 `id` 键入（`resolve` 大小写无关，`EDIT.GROUP` 能命中）。

筛下来的 11 条**不是漏掉的，而是本来就重复的**：

- **八个工具切换**（`stage.selectTool` … `stage.drawTextTool`）：绘制工具与绘图命令是同一
  能力的两个入口（步骤 6 已记）。`RECTANGLE` 这个词已经属于命令，工具不该来抢。
- **`edit.delete`**：`ERASE`/`E` 严格更强——没选中时它会提示选择对象，而 `edit.delete` 只能
  报「没有选中对象」。给 `edit.delete` 一个 `DELETE` 别名等于给同一件事造两个词，其中一个更差。

剪贴板三条借 AutoCAD 的既有解法：`COPYCLIP` / `CUTCLIP` / `PASTECLIP`，因为 `COPY` 这个词
已经被几何复制占着——AutoCAD 当年做的正是这个区分。

## 9. 重名抛错，不兜底

`createComposeCommandRegistry` 今天就在重名时抛错。宿主注入之后重名变得可能，但**兜底比抛错
更糟**：丢弃后来的会让宿主的命令静默消失，覆盖先前的会让内建命令被宿主意外改写，而两者都要
用户在命令行里敲一次才能发现。重名的含义是「敲这个词该执行哪条命令无法从注册处读出」，这在
运行期没有正确答案。

内建的八条与本刀新增的别名表都是**本仓库作者的**，因此这条抛错防的是第三方宿主的配置错误，
它应当在开发期第一次渲染就炸出来。

## 10. 会话仍住 Stage

宿主注入的是**定义**，不是会话。`useStageDrafting` 把注入的定义与内建的八条合成注册表，
解析、启动、推进、渲染提示全部不变。合并的是「能敲什么」，不是「谁在跑」——后者一旦搬走，
提示文本、橡皮筋预览与捕捉标记这三样同一份状态的呈现就要逐帧回传给宿主，凭空造出一个跨包
协议（这条判断在步骤 6 已经写进 AGENTS.md）。

## 11. 注册表在提交那一刻才建（实现时才暴露）

宿主注入的定义**引用不可能稳定**——它们携带的 `disabledReason` 必须跟着选择集与文档走，因此
每次变化都是新的一份数组。第一版把合并后的注册表挂在 `useMemo` 上，于是这条身份变化一路传染：
注册表 → `start` → `submit` → `handleKeyDown` → 整个会话对象，Stage 每次文档或选择变化都要重挂
这批回调。

症状不是「慢」，而是**端到端用例开始间歇性失败**：`boundingBox()` 在 `toBeVisible()` 之后仍返回
`null`，而且每轮失败的不是同一条。改前的 `main` 连跑两轮全绿，改后三轮各挂一到两条；把注入临时
关掉，两轮又全绿——这是判据，不是猜测。

解析只发生在用户按下 Enter 的那一刻，因此注册表在**那时**才建：几十个键的 Map 现建一次，远小于
让它污染每一帧的渲染路径。这条已经写进 stage 规范，因为它是不变量而不是一次优化：任何「随文档
变化的集合」挂进渲染期记忆化都会重演。
