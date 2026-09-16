# 变更：图表升格成第一方物料（折线 / 柱 / 饼）

## 原因

这个产品的目标是让实施工程师快速搭大屏，而**产品本身一个图表都没有**
（`docs/dashboard-dogfood-issues.md` 的 M-1）。唯一那个 `echarts-bar` 住在
`app/src/StageDemo.tsx` 里，而 AGENTS 明写示例应用「不是正式编辑器产品」、「不要把示例应用
中的临时状态或演示交互当成稳定公共 API」。

还原一张储能大屏时，效果图里的**折线**（功率曲线、SOC 变化）与**环形**（电量构成）都没有
对应物料，只能用柱状图顶替、用圆角容器套圆角容器拼一个假环形。

## 变更内容

- 新增包 **`@compose-ui/chart-materials`**：图表 Renderer、Preset 与 Inspector，依赖 echarts。
  **不放进 `@compose-ui/materials`**：那会让每一个只画方块和文字的宿主也装上一个百万级的
  图表运行时。这与 `dxf`、`svg-import` 各自独立成包是同一条判断——**带第三方依赖的能力
  自己占一个包**，且那个依赖不出现在公共 API 的类型里，换掉它不该是一次破坏性变更。
- **一个 Renderer，`kind` 是三元联合**（`line` / `bar` / `pie`），**不是三个 Renderer**：
  三者只差 echarts 的 `series.type`，标题、类目、系列、配色、坐标轴这些逐字相同。另立三个
  会让绑定契约、Inspector、校验与测量四条路径各多两支逐字相同的实现——这是 `Curve` 的
  `kind` 四元联合那条判断的第二次应用。
- **物料面板出三格**（折线图 / 柱状图 / 饼图）：用户要找的是「饼图」，而不是「图表，然后改
  类型」。三个 Preset 指向同一个 Renderer，与 `rect` 是 `curve` 的一个 Preset 同构。
- 数据模型是 `categories: string[]` 加 `series: { name, data: number[] }[]`，三种 kind 共用；
  饼图取第一条系列，类目即扇区名。两个数组都是可绑定的 Renderer prop，因此页面脚本喂得进来，
  也自动拿到刚落地的**批量录入**。
- 颜色全部来自 props（`palette` / `textColor` / `axisColor`），**不内置配色表**——与「不内置
  电压等级色表」同一条。
- 尺寸是固定盒，**不声明 measurement**：图表没有「内容有多大」这个问题，它填满给它的盒。

## 影响

- 受影响的规范：`basic-materials`（新增图表物料需求）、`property-panel`（两条依赖示例图表的
  需求改为指向图表物料包；「图表运行时不是属性面板依赖」这条保留并加强——它也不是基础物料
  包的依赖）
- 受影响的代码：
  - 新增 `packages/chart-materials/`
  - `app/src/StageDemo.tsx`：示例改为消费第一方图表物料，删掉那份演示用的 `echarts-bar`
  - `AGENTS.md`：新增包的架构边界
