# 变更：共享文字样式

## 原因

搭一张大屏时**每一条文字的字号、字重、颜色都是一条条填的**
（`docs/dashboard-dogfood-issues.md` 的 A-1）：一张 12 行的表格里 48 条文字各填一遍，320 个
实体跑下来约 2600 次交互。而这些文字只有三四种样子——「卡片标题」「指标数值」「单位」
「表头」。**这正是这个产品要解决的问题本身**：把重复的页面编码工作转化为可视化编排。

改一次全改同样没有：客户说「标题小两号」，要逐个改 48 次。

## 变更内容

- 文档新增可选字段 `styles`：一张**文字样式**表（id → 名称 + 一组排版 props）。
  **缺席即没有样式**，因此既有文档逐字节不变、不需要迁移、协议版本不变——与
  `Transform.pivot`、`cornerRadius`、`fillRule` 是同一条。
- Entity 新增可选 Component `Style`：`{ text?: styleId }`。缺席即不跟随任何样式。
- **跟随样式的字段在文档里缺席**：解析是 `样式的值` 垫底、`作者写下的 props` 覆盖。
  因此「应用样式」这条命令**同时删掉它管辖的那几个 props**——不删的话样式加上去什么都不会
  变，而屏幕上没有任何东西解释为什么。
- 解析是**派生的，住在布局 Runtime**，与导线、填充并排：Runtime 每次拿到新文档时跑一遍纯
  函数 `resolveComposeStyles(document) → document`，下游（Stage 渲染、Preview、文字测量、
  Inspector）**一行不改**。逐条路径各解析一次正是仓库为导线明令禁止的那一类。
- 样式**排在求解之前**而不是之中：它不依赖几何（导线与填充依赖），而文字测量要用到排版值。
- 悬空引用**不让文档非法**：指向不存在的样式只是解析失败，该 Entity 保留作者写下的值并在
  Inspector 标为失效——与导线绑定「还没配 / 配错了 / 配的东西没了」是同一条判断。

## 影响

- 受影响的规范：`compose-document`（`styles` 字段与 `Style` Component）、`layout-engine`
  （解析住在 Runtime）
- 受影响的代码：
  - `packages/core`：协议类型、读取入口、校验
  - `packages/core` 或 `packages/layout-engine`：`resolveComposeStyles` 纯函数
  - `packages/layout-engine`：Runtime 在 solve 前应用它
  - 命令：应用样式 / 脱离样式 / 建样式 / 改样式
