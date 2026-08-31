## ADDED Requirements

### Requirement: 提示声明这一步在光标旁印什么

`ComposeCommandPrompt` MUST 提供可选的 `cursorInput`，声明这一步要在光标旁印出来的内容：
一个当前值（`value`），以及可选的一个二选一档位（`toggle: { value, keyword }`）。缺席表示
这一步不印。

`fields` 覆盖不了它：`fields` 说的是「这一步的**点**怎么参数化」，而有的步骤要的根本不是点
——`POLYGON` 的第一步要的是一个数加一个二选一。命令行在图面底部，用户的眼睛此刻在光标上，
「敲一个数」这句话说在他没有在看的地方等于没说。

它 MUST 由**提示自己声明**，MUST NOT 由宿主按命令 id 反推：宿主不认识任何一条命令的内部。
反推 `accepts` 同样不行——只有命令知道那个框里该印什么值，宿主手上只有一句提示文案。

`cursorInput` MUST 只是**呈现**，MUST NOT 成为第五种输入端：输入仍然只有命令行一个。宿主
MUST NOT 解析或校验 `value`——取值范围是命令自己的规则，放在宿主等于让同一条规则有两处来源。

`toggle` MUST NOT 参与宿主的字段轮转：档位不是一个能键入的数，把 `Tab` 的焦点带到一个打不了
字的地方是错的。宿主 MUST 把 `Tab` 直接派发成 `{ kind: 'keyword', key: toggle.keyword }`，
与用户在命令行敲那个关键字**逐字等价**——键位与敲字是同一件事的两个入口，不是两条实现。

本字段 MUST 只含已本地化的文案与一个关键字键：`commands` 包零运行时依赖、不认识任何文档协议，
这条不因为多了一个字段而松动。

#### Scenario: 缺席时呈现不变

- **WHEN** 一条提示没有声明 `cursorInput`
- **THEN** 宿主的呈现与本要求引入之前完全一致

#### Scenario: 档位由提示给出当前值与切过去的关键字

- **WHEN** 一条提示声明了 `cursorInput.toggle`
- **THEN** 它同时给出当前档位的已本地化文案与切到另一档要派发的关键字

#### Scenario: 同一件事的两个入口

- **WHEN** 用户在声明了 `toggle` 的一步上按 `Tab`
- **THEN** 会话收到的输入与用户在命令行敲下 `toggle.keyword` 时收到的完全相同
