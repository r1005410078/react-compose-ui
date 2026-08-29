## ADDED Requirements

### Requirement: 会重开的命令与两级 Escape

命令提交后，Stage MUST 检查该命令定义的 `repeat`：为真时立刻以同一个命令 id 重开一次全新
会话，提示回到第一步。

**`activeCommandId` MUST NOT 在重开期间闪成 `null`。** 宿主的工具栏按下态读它，闪一下会让
按钮抖动；重开 MUST 在同一次更新里完成，而不是「结束、再启动」两拍。

重开 MUST NOT 触碰选择集：绘图命令提交之后本来就不选中新建的对象，重开不改这一条。

**会重开的命令里 `Escape` MUST 分两级**，与几何编辑里 `Escape` 的两级（先熄灭热夹点、再退出
会话）同构：

- 当前这一条**已经取过点** → 放弃这一条，命令留着并回到第一步
- 当前这一条**一个点都没取** → 退出命令

不分级的话，连续取点的命令（`ARROW`）的 `Enter` 变成「结束这一条并开始下一条」，唯一的退出
只剩 `Escape`，而它此刻的含义（放弃整条命令）会把用户刚画一半的东西一起扔掉。

不声明 `repeat` 的命令 `Escape` 语义不变（放弃整条命令）：那里没有「下一条」可言。

#### Scenario: 画完一条接着画下一条

- **WHEN** `WIRE` 取够两个点提交
- **THEN** 命令仍在跑，提示回到第一步，且已落地的那条导线保留

#### Scenario: 连画三条得到三个 Entity

- **WHEN** 连续画三条导线
- **THEN** 文档里有三个导线 Entity，中途没有按过任何键

#### Scenario: 按下态不抖

- **WHEN** 连画多条导线
- **THEN** 上报的当前命令 id 始终是 `WIRE`，MUST NOT 出现过 `null`

#### Scenario: Escape 先放弃这一条

- **WHEN** 一条新导线已经取过第一个点，用户按 `Escape`
- **THEN** 这一条被放弃，命令仍在跑且提示回到第一步
- **WHEN** 再按一次 `Escape`
- **THEN** 命令结束

#### Scenario: 不重开的命令 Escape 不变

- **WHEN** `RECTANGLE` 取过一个角点后按 `Escape`
- **THEN** 命令直接结束
