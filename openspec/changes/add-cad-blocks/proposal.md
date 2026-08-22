# CAD 块定义与插入

## Why

路线图步骤 7。画接线图的高频动作是**同一个符号插很多遍**：一张一次接线图上几十个断路器、
互感器、隔离开关，逐个画完全不可行。块是 CAD 相对普通画图工具的第二个分水岭（第一个是
6b 的对象捕捉）。

它也是 DXF `BLOCK`/`INSERT` 的直接对应，因此步骤 9 的导入产物就是本刀定下的形状。

## 一个必须先说清的发现：块不能直接做成 Component Asset

路线图写的是「块即组件」。读代码之后这条**不能按字面实现**：

```ts
export interface ComposeBaseComponentAsset {
  readonly document: ComposeDocument   // ← 页面文档协议
}
```

而 `validateComposeDocument` 要求 `rootIds` 非空**且每个根必须带 Frame Component**，每个
Entity 必须有 `LayoutItem`。CAD 图元两样都没有——这正是 AGENTS.md 刚记下的「CAD 没有盒模型」。
把 CAD 几何塞进 `ComposeDocument` 会被校验器当场拦下。

Variant 的操作代数也只对得上一半：`move-entity` 带 `parentId` 与 `beforeEntityId`，假设内容是
一棵树，而 CAD 是平坦的。

因此本刀按 **DXF 的原始形状**做：块定义住在 CAD 文档自己的块表里，与 `entities` 平级。
理由不只是「简单」——步骤 9 的 DXF 导入读出来的就是这个结构，先做资源化等于绕远路去做一个
形状还没定下来的东西的存储。跨文档复用与真正的变体继承另起一刀。

## What Changes

`@compose-ui/cad` 新增块表与插入：

- **`CadDocument.blocks`**：`blockId → { name, rootIds, entities }`，各自是一份**平坦的、
  块局部坐标**的图元集合。与 DXF 的 BLOCK 表同构，也让顶层继续保持平坦。
- **`CadInsert` Component**：`{ blockId, position, rotation, scale }`。`scale` 是 `{x, y}`
  而不是单个数——**接线图要镜像符号**（负比例），补一个轴比改协议便宜。
- **实例几何是求出来的，不是存下来的**：块局部坐标经 scale → rotation → translate 得到世界
  坐标。定义改了，全部实例跟着变，这正是块存在的理由。

命中、框选与对象捕捉 MUST 看见实例展开后的几何：插完断路器要能从它的接线端点起笔画导线，
看不见等于块只是一张图片。

两条命令：

- **`BLOCK` / `B`**：把当前选择集变成一个块定义，原地替换为一个实例。这里「先选后执行」
  第二次兑现。
- **`INSERT` / `I`**：按名字插入，插入点走 6b 的对象捕捉。

## 变体这一刀怎么处理

「断路器闭合/断开」在本刀里就是**两个块定义**。够用，且与 DXF 一致——DXF 本来也没有变体继承。
真正的 Variant（改父定义、子定义跟着变）要等块资源化，与 Component Asset v2 的继承对齐。

## 本刀不做

- **图纸即组件**（整份 CAD 被页面的组件实例渲染）——另一个方向，风险来源独立，单开一刀。
- 块资源化（跨文档复用、`.cadblock` 文件、变体继承）。
- 嵌套块（块里插块）。DXF 允许，示意图极少用；本刀显式拒绝并给出可定位的校验错误，
  免得后来者以为它「碰巧能用」。
- 属性块（`ATTDEF`/`ATTRIB`，可编辑文字标注）。要等文字图元。

## Impact

- Affected specs: `cad-document`
- Affected code: `packages/cad/src/document/`、`packages/cad/src/block/`（新增）、
  `packages/cad/src/selection/`、`packages/cad/src/command/`、`packages/cad-canvas/src/`
- `CadDocument` 增加 `blocks` 字段：`schemaVersion` 保持 1，旧文件没有该字段时按空块表读入
