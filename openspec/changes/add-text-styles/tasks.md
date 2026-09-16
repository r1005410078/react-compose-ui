## 1. 协议

- [x] 1.1 `ComposeDocument.styles` 可选字段与 `ComposeTextStyle` 类型
- [x] 1.2 可选 `Style` Component 与读取入口 `getComposeStyleRef`、三态 `getComposeTextStyleState`
- [x] 1.3 校验：样式表结构合法（name 非空、props 是对象）；**悬空引用不算非法**，用例两边都钉住
- [x] 1.4 `resolveComposeStyles(document) → document` 纯函数（样式垫底、作者值覆盖）

## 2. 接进 Runtime

- [x] 2.1 布局 Runtime 在 solve **之前**应用解析；输入身份（`document`）与拿去求解的那份
      （`styledDocument`）分开，`sourceDocument` 仍是输入
- [x] 2.2 下游（Stage 渲染、Preview、测量、Inspector）一行不改——全套门禁绿即是证据

## 3. 命令

- [x] 3.1 `document.style.text.set`（**upsert**，新建与更新的载荷与补丁逐字相同，差别只是
      「这个 id 在不在」——那不是用户能说出来的区别）与 `document.style.text.remove`。
      样式表缺席时第一条 `set` 先把整张表建出来：补丁引擎要求父容器已存在
- [x] 3.2 `planComposeApplyTextStyle`：写引用**并删掉被管辖的 props**，一个 batch；
      不造新命令词，用既有的 `entity.renderer.props.set` + `entity.component.update`
- [x] 3.3 `planComposeDetachTextStyle`：把解析值写成作者值并删引用，呈现不变

## 4. 用例

- [x] 4.1 单测：解析是纯函数，不改输入文档；没有跟随者时原样交回输入引用
- [x] 4.2 单测：样式垫底、作者值覆盖，且覆盖只影响这一处
- [x] 4.3 单测：悬空引用保留作者值，三态可区分
- [x] 4.4 单测：应用样式删掉被管辖的 props；脱离样式写回解析值；无目标时不产出命令
- [x] 4.5 单测：Runtime 交出的已解算文档里排版值已解析，`sourceDocument` 仍是输入
- [x] 4.6 单测：Hug 文字按样式字号测量（这正是样式排在求解之前的理由）

## 5. 编辑器接线

- [x] 5.1 Inspector 的「文字样式」分组：下拉选择已有样式、提取、写回、脱离。
      **不做独立面板**：样式的三件事都以「当前选中的这一条」为对象，放进 Inspector 才与
      它作用的东西在同一处；独立面板要另建一套选区通道
- [x] 5.2 应用与脱离入口；悬空引用出一行说明
- [x] 5.3 「提取为样式」：从当前这一条取排版值建样式并应用。**不收 `text`**——那是这一条
      自己的内容，收进样式会让所有跟随者显示同一句话
- [x] 5.4 e2e：提取 → 应用到第二条 → 改一条只影响一条 → 写回样式两条一起变 → 脱离呈现不变
- [x] 5.5 重命名与删除样式。重命名走同一条 **upsert**（同 id、新 name、原样 props），不造
      第二条命令词；删除出确认框并**把跟随者数量说出来**——被管辖的字段在「应用」那一步就已
      从跟随者身上删掉，样式没了它们会回到默认排版，那是一次看得见的改动
- [x] 5.6 多选批量应用：Inspector 的样式分组改按**一组** Entity 收，单选是它恰好一个成员的
      退化情形；多选面板（此前只有一句空态）多出样式一段。混合与「不跟随」分别呈现；提取与
      写回只在单选下出现并说明理由
- [x] 5.7 用例：组件测试 6 条（重命名 / 删除确认与数量 / 批量 batch / 混合态 / 多选面板两档），
      e2e 一条走完重命名 → 多选批量应用 → 删除后回到默认排版

## 6. 门禁

- [x] 6.1 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`（372 条 e2e 全绿）
