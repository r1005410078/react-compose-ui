# stage 规范增量

## MODIFIED Requirements

### Requirement: 直接绘制 Preset

Stage MUST 为 container、rectangle、arrow、circle 与 text 提供受控绘制工具。绘制工具 MUST 在拖拽期间展示瞬时预览，正常松手时通过 Registry Preset 创建一个合法 Entity，取消时不得产生文档事务。container 工具在拖拽距离小于有效阈值时 MUST 回退到 Container Preset 的默认尺寸并以按下点为左上角，MUST NOT 创建退化尺寸的容器。

arrow 与 circle 工具 MUST 产出带 `Curve` 的 Entity，落地时 MUST 写入**真实几何**——直线写
两个端点，整圆写圆心与半径。MUST NOT 用三态方向编码表达朝向：方向是两个坐标的差，多一层
编码就多一处要与渲染、命中、捕捉分别对齐的表示。退化轴（拖成水平或垂直）MUST 由既有的曲线
最小范围常量钳住，MUST NOT 引入第二套像素偏移补丁。

line MUST NOT 出现在绘制工具里：`LINE` 命令产出同一种 `Curve` Entity，而同一个动作有两个
手感不同的入口会让用户先想「我在用哪个」。留下的是命令那一种。

#### Scenario: 拖拽绘制容器与形状

- **WHEN** 用户在任一 container 或形状绘制工具中从 surface 拖出有效 bounds 并松手
- **THEN** Stage 创建一个具有相同规范化世界 bounds 的对应 Preset Entity
- **AND** 该 Entity 成为选区，写入一个可撤销事务后请求切换到 select 工具，避免后续点击继续绘制

#### Scenario: 点击绘制容器回退默认尺寸

- **WHEN** 用户使用 container 工具在 surface 上单击而没有产生有效拖拽距离
- **THEN** Stage 以按下点为左上角、按 Container Preset 默认尺寸创建容器

#### Scenario: 反向拖拽的箭头指向拖拽方向

- **WHEN** 用户用 arrow 工具从右下向左上拖拽并松手
- **THEN** 几何的终点在左上，箭头朝左上
- **AND** LayoutItem 尺寸为正

#### Scenario: 没有 line 绘制工具

- **WHEN** 宿主枚举可用的绘制工具
- **THEN** 其中不包含 line
- **AND** 用户仍可用 `LINE` 命令画线

### Requirement: 线状节点不以包围盒拦截指针

带 `Curve` 的 Entity 在 Scene 中 MUST 作为线状节点渲染：节点盒本身 MUST NOT 接收指针事件，
命中 MUST 由物料内部的透明加宽 stroke 承担，其宽度 MUST 显著大于视觉线宽。

线状判定 MUST 依据 `Curve` Component 而不是 Renderer 类型——「这个 Entity 是不是线状的」是
几何问题，按物料类型枚举会在每加一种线状物料时漏掉一处。

**填充过的曲线是例外中的例外**：填色区域是用户看见的墨，因此它 MUST 接收指针事件——命中层
在有可见填充时 MUST 同时覆盖填充区域，未填充时 MUST 只覆盖描边。空心图形的内部 MUST NOT
命中：那正是「包围盒里绝大部分是空的」这条理由覆盖的情形。

#### Scenario: 包围盒空角不选中曲线

- **WHEN** 在非 100% 缩放下点击对角线包围盒内远离线身的空角
- **THEN** 该曲线不被选中

#### Scenario: 点击线身选中曲线

- **WHEN** 点击曲线的线身
- **THEN** 该曲线被选中并打开其属性面板

#### Scenario: 填充过的形状内部可点

- **WHEN** 一个整圆曲线有不透明填充，用户点击它的圆心附近
- **THEN** 该曲线被选中

#### Scenario: 空心形状内部不可点

- **WHEN** 同一个整圆曲线没有填充，用户点击它的圆心附近
- **THEN** 该曲线不被选中

### Requirement: 曲线的两条命中路径给出一致答案

Stage 的 DOM 点选与场景索引的距离判定 MUST 对同一个位置给出一致的命中结论。DOM 路径由浏览器
按 `viewBox` 完成变换，索引路径由 stage-engine 自己算——两者各做各的，因此 MUST 按**同一组
几何数值**分别有用例：渲染侧断言取景框与拉伸比例，索引侧断言同一位置的命中结论。
MUST NOT 只验其中一条。

**填充带来的命中面积同样落在这条一致性下**：DOM 侧由指针事件规则覆盖填充区域，索引侧由点在
几何内的判定覆盖，两者 MUST 对同一位置给出同一结论。

端到端 MUST 在**非 100% 缩放**下覆盖 DOM 点选：`world = (屏幕 − 视口) / 缩放`，缩放恒为 1 时
盒到几何的比例与视口缩放会互相掩盖，漏掉的换算要到很久以后才暴露。

#### Scenario: 拉宽后点线身命中

- **WHEN** 在非 100% 缩放下把一条曲线的盒拉宽，然后点在新形状的线身上
- **THEN** 点选选中它

#### Scenario: 盒角不命中

- **WHEN** 在非 100% 缩放下点在该曲线包围盒的空角上
- **THEN** 点选不选中它

#### Scenario: 渲染与索引按同一组数值各自有断言

- **WHEN** 一条曲线的盒被拉成紧包围盒的两倍宽
- **THEN** 渲染侧的用例断言取景框仍是紧包围盒且允许非等比拉伸
- **AND** 索引侧的用例按同一组数值断言新形状命中、旧形状不命中

#### Scenario: 填充区域两条路径同答案

- **WHEN** 在填充过的闭合曲线内部取一个远离描边的点
- **THEN** DOM 点选与索引判定都认为命中

## REMOVED Requirements

### Requirement: 两点 Shape 的端点选区

**Reason**: 两点直线的端点就在紧包围盒的对角，「曲线按 viewBox 跟随盒伸缩」交付之后，拖盒
角手柄与拖那个端点落点逐像素相同。端点 UI 当初存在是因为 Shape 的线没有可用的盒语义，
而现在有了。

留下的差额只有轴对齐的线（退化轴钳到最小范围）无法靠盒手柄掰成斜的——那正是步骤 10
（顶点编辑）要回答的「拖盒手柄与拖顶点各干什么」。把一套只认 line/arrow 的端点 UI 搬进
`Curve`，等于在步骤 10 必须替换的位置先盖一栋房子，还会顺手替它回答那个问题。

**Migration**: 无文档影响。空窗期内轴对齐的线要改方向须重画一次，或用 `LINE` 命令键入
精确坐标。
