# library-browser 规范增量

## ADDED Requirements

### Requirement: 接上页面库与让它成为入口是两件事

宿主 MUST 能声明「页面库可达，但编辑器从画布起手」。声明走 `ComposeEditorLibraryConfig`
上的可选 `openOnStart`，它**缺席即 `true`**——页面库一旦接上就是应用入口，这是它的产品定位，
因此既有宿主行为逐字不变。可选字段的缺席值 MUST 保住既有行为：反过来会让每一个已经接上库的
宿主在升级之后静默换掉入口，而那个变化在屏幕上读起来像「页面库没了」。

`openOnStart` MUST 只决定**初值**，MUST NOT 成为第二份「当前在不在库里」的事实——那份状态
仍然只有一个持有者，回库与离开库仍走既有那两条路径。因此它 MUST NOT 是受控属性：宿主把它
从 `true` 改成 `false` 不会把用户从已经打开的库里拽走。

**从库起手才不自动打开首页。**「不自动打开首页」这条既有行为的判据 MUST 是**这次起手在不在
库里**而不是「宿主接没接库」：按后者判会让 `openOnStart: false` 的宿主落在一块什么都没打开的
空画布上。它也 MUST NOT 读「此刻在不在库里」——那是会变的，用户回一趟库再出来，首页就会在他
背后被打开。

`openOnStart: false` MUST NOT 收走任何能力：标志那扇门、应用菜单里的「返回页面库」、图墙、
全屏演示与「就用这个」照旧都在。收走的只是「打开编辑器先看到哪一屏」。

#### Scenario: 缺席即入口

- **WHEN** 宿主传入 `pages.library` 而不写 `openOnStart`
- **THEN** 编辑器从页面库那一屏起手，与本字段存在之前逐字相同

#### Scenario: 显式让出入口

- **WHEN** 宿主传入 `pages.library` 并写 `openOnStart: false`
- **THEN** 编辑器从画布起手
- **AND** 标志那扇门与应用菜单里的「返回页面库」仍在，点下去进得了页面库

#### Scenario: 让出入口时首页照常自动打开

- **WHEN** 宿主传入 `pages.library` 并写 `openOnStart: false`，且页面目录有首页
- **THEN** 首页被自动打开，与没有接页面库时逐字相同

#### Scenario: 它不是受控属性

- **WHEN** 用户已经进了页面库，宿主此时把 `openOnStart` 从 `true` 改成 `false`
- **THEN** 用户仍在页面库里，不被拽回画布
