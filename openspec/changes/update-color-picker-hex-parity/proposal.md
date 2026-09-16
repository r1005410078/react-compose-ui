# 变更：两种取色器形态对齐——HEX 常显，且每个取色器只有一个 HEX 框

## 原因

同一件事（挑一个颜色）在属性面板里有两种形态，HEX 一个露一个藏
（`docs/dashboard-dogfood-issues.md` 的 C-2）：

- 「背景填充」走 `ComposePaintPicker`，它内嵌 `ComposeColorPicker`，HEX 与只读 RGBA 直接可见。
- 「边框颜色」「文字颜色」走 `ComposeColorPicker` 的默认（带 Trigger）形态，HEX 被折进默认
  收起的 `<details>「精确」`。

**这不是疏漏，是一条要推翻的既有决定**：`specs/components/spec.md` 明写「默认（带 Trigger 的）
形态的可见 UI MUST 不显示 HEX、RGB、HSL 或 CSS 文本输入」。推翻它的理由是这个产品的主路径
——实施工程师照着设计稿搭大屏，而设计稿给的就是 HEX。代价不对称：多一行读数是看得见的一点
拥挤，藏起来是**用户找不到**，而屏幕上没有任何东西提示那个折叠块里有什么。

顺带收掉一处源码上的重复：同一个 HEX 读数在 JSX 里写了**两遍**（顶部值行一份、`<details>`
里一份），露哪一份由样式表决定（`styles.css:783` 把内嵌形态的 `<details>` 整个
`display: none`）。用户看不见两个框，但**改其中一份的人很容易漏掉另一份**——修 C-1 时这两处
就是各改了一遍。「这块面板长什么样」应当在组件里读得出来，而不是要去样式表里找答案。

## 变更内容

- **BREAKING**（呈现）：默认形态的可见 UI 显示 HEX 与不透明度精确输入，不再要求隐藏文本输入。
- 删除 `<details>「精确」` 折叠块与那条把它藏掉的样式规则；两种形态共用**同一块值行**，
  因此 HEX 输入在源码里只有一处。
- 值行里两种形态的差别只保留有理由的那一处：**色块只在内嵌形态画**——默认形态的 Trigger 上
  已经有一个，面板里再画一个是同一件事说两遍。

## 影响

- 受影响的规范：`components`
- 受影响的代码：
  - `packages/components/src/color-picker/compose-color-picker.tsx`
  - `packages/components/src/color-picker/styles.css`
  - 驱动脚本与 skill 里「HEX 藏在折叠的『精确』里」那段绕法可以删掉
