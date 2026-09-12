## ADDED Requirements

### Requirement: 矩形命令落地成可几何编辑的闭合曲线

Stage MUST 把 `RECTANGLE` 产出的四顶点闭合多段线按与其余曲线**完全相同**的那条路径落地：
`curve` Preset、几何写进 `Curve` 与 `LayoutItem`、换算走 `normalizeComposeCurveGeometry`。
MUST NOT 为矩形另开一条落地分支——另开一份的症状是「命令画的矩形与 `PLINE` 画的四点折线在
盒对齐规则上差一点」，而这种差别要等到有人把两者叠在一起时才会被发现。

落地的 Entity MUST 因此**默认不填充**：`curve` Preset 的 `Appearance.backgroundPaint` 本来
就是 `transparent`。这条 MUST NOT 靠在落地处覆写外观来实现——外观的事实来源是 Preset。

落点父级 MUST 与其余曲线一致：几何紧包围盒中心所在的容器，不在任何容器里时落进**激活场景**。
曲线不是容器，因此 MUST NOT 升格成一块新场景。

画出来的矩形 MUST 满足几何编辑的准入谓词，因此双击它 MUST 进入几何编辑会话，四个顶点与四条
边的中点 MUST 显形为夹点。

绘图覆盖层在取第二个角点之前 MUST 画出这两点确定的**闭合矩形轮廓**而不是一条对角线；该轮廓
MUST 来自会话的 `preview` 查询，MUST NOT 由覆盖层自己从两个点推导矩形。

#### Scenario: R 画出的是曲线

- **WHEN** 用户启动 `RECTANGLE` 并取两个对角点
- **THEN** 新建的 Entity 使用 `curve` Preset 并带 `Curve` Component，其几何是 `closed`
  的四顶点多段线
- **AND** 它的 `LayoutItem` 尺寸等于两个角点确定的宽高

#### Scenario: 默认不填充

- **WHEN** 用 `RECTANGLE` 画一个矩形，且它盖在另一个对象上面
- **THEN** 下面那个对象仍然看得见——新矩形只有描边，没有填充

#### Scenario: 双击进顶点模式

- **WHEN** 单击选中刚画出来的矩形，再双击它
- **THEN** 进入几何编辑会话，四个顶点夹点与四个段中点夹点显形，盒手柄让位

#### Scenario: 取第二点之前就能看见矩形

- **WHEN** `RECTANGLE` 取过第一个角点，指针移动到另一处
- **THEN** 覆盖层画出这两点确定的闭合矩形轮廓，而不是一条对角线

#### Scenario: 画在场景空白处落进激活场景

- **WHEN** 两个角点都落在所有容器之外
- **THEN** 新曲线成为激活场景的子级，MUST NOT 升格成一块新场景

## REMOVED Requirements

### Requirement: 绘图命令的盒效果落地成物料 Entity

**移除理由**：`RECTANGLE` 是 `StageDraftingEffect.boxes` 唯一的产出者，它改成产出闭合多段线
之后没有任何命令再产出盒，这条落地路径连同那个效果字段一起删除——留着就是没有消费者的死代码。

当初这条要求的判据是「用户画完之后想对它做什么」，答案取的是「填色、调圆角、往里塞东西」。
在接线图上这个答案是错的：用户画的是设备外框与分区框，画完之后想做的是**改形状**——把某个
角对到导线端点上、把某条边整体挪一格，而这三件事只有 `Curve` 做得到。

需要背景、边框、圆角与子级时，从物料面板添加 Rectangle 的那条入口不受影响；`rectangle`
Preset 与 `entityFromDrawingSeed` / `boundsInParentSpace` 都保留，拖拽绘制容器与文字仍在用。
