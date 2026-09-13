## ADDED Requirements

### Requirement: hatch Preset 是求面产出的填充

`materials` MUST 提供曲线 Renderer 的又一个 Preset `hatch`：**有填充、无描边**。
无描边是因为这块面的边界已经由那些边界对象自己画着了，再画一遍就是同一条线画两遍。

它 MUST `paletteHidden: 'toolbar'`——工具栏已提供入口，与 `arrow`、`circle` 同一条。
从物料面板拖一个「填充」出来读不出意图：它的全部意义来自它是从某块面求出来的。

首次默认色 MUST 是一块低饱和、压得住的深色。判据是**角色**而不是「没有最常见的那一档」：
区域填充垫在符号底下，必须让上面的墨读得出来——这与导线默认红取最常见的那一档是同一条判据的
两个答案。

#### Scenario: 默认无描边

- **WHEN** 从 `hatch` Preset 创建一个 Entity
- **THEN** 它有填充色而描边为无

#### Scenario: 不出现在物料面板

- **WHEN** 物料面板按默认货架列出 Preset
- **THEN** `hatch` 不在其中

### Requirement: 填充的 Inspector 有重新生成与失效标记

选中一个带 `Hatch` 的 Entity 时，Inspector MUST 提供「重新生成」：拿 `seed` 按**当前**边界把
那次求解原样再跑一遍。它 MUST 是 Inspector 上的入口而不是画布手势——画布上「按当前边界重算」
与「新建一块填充」逐字相同，做成两个手势等于给同一件事造第二个入口（与导线的「解除绑定」
是同一条例外理由）。

重算失败（`seed` 处已经没有封闭的面）时 MUST 保留原几何并标为**失效**，
MUST NOT 静默留在原地：所有做了关联的产品里，用户抱怨的都不是「它会断」而是「断了我不知道」。
「还没配」「配错了」「配的东西没了」MUST 可区分，与悬空的导线绑定同一套。

填充色 MUST 走既有的外观分组（`Appearance.backgroundPaint`），MUST NOT 另开一个字段——
外观 Inspector、数据绑定与外观动画轨道因此一行都不用写。

#### Scenario: 重新生成按当前边界重算

- **WHEN** 边界对象被移动之后，用户对这块填充按「重新生成」
- **THEN** 几何按当前边界重新求出

#### Scenario: 重算失败时标为失效

- **WHEN** `seed` 处已经没有封闭的面
- **THEN** 保留原几何，并在 Inspector 上标为失效

#### Scenario: 改色走既有的外观分组

- **WHEN** 选中一块填充并在外观分组改背景色
- **THEN** 它的填充色改变，与改任何一个曲线 Entity 的背景色是同一条路径
