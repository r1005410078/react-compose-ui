## 1. 几何

- [x] 1.1 `core/curve-geometry.ts` 新增正多边形顶点求解：入参 `(center, point, sides, mode)`，
      内接取外接圆半径 `R`、首顶点角 `θ₀`，外切取 `R / cos(π/n)`、首顶点角 `θ₀ + 180/n`；
      角度约定与 `angleDegrees` 一致（`atan2(−dy, dx)`，Y 轴向下），绕向与 `rectangleCurve`
      相同（屏幕顺时针）
- [x] 1.2 单元测试：内接的全部顶点到中心等距且其中一个正好落在落点上；外切的某条边中点正好
      落在落点上；同一落点下两档的外接圆半径相差 `1 / cos(π/n)`；`n = 3` 与 `n = 1024` 都算得出

## 2. 命令会话

- [x] 2.1 `createStagePolygonSession`：三步（边数 / 中心点 / 半径），边数步
      `accepts: ['text']` 且不声明 `fields`，中心步 `absolute`，半径步 `radius` + `measured`
- [x] 2.2 半径步的 `I` / `C` 关键字：只列出能切过去的那一个，切换同时改提示文本与关键字，
      只作用于本次会话
- [x] 2.3 `preview(point)` 返回完整多边形；`R` 为 0 的那一帧不画
- [x] 2.4 拒绝：边数非 3–1024 的整数、`R` 为 0，两者都 `rejected` 且不结束会话
- [x] 2.5 `createStagePolygonCommand`：`id: 'POLYGON'`、`aliases: ['POL']`、
      `category: drawCategory`，**不声明 `repeat`**、**不绑单键**
- [x] 2.6 `drafting-types.ts` 新增文案键：`polygonTitle`、`specifySides`、
      `specifyPolygonCenter`（不复用 `specifyCenter`，它写着「圆心」）、
      `specifyInscribedRadius`、`specifyCircumscribedRadius`、`inscribedKeyword`、
      `circumscribedKeyword`、`invalidSides`；复用 `degenerateShape` 与 `expectedPoint`
- [x] 2.7 单元测试：直接确认取默认边数、默认跟着上一次走、越界与非整数被拒绝、
      两档顶点不同、下一次从内接起步、提交效果没有意图标记

## 3. 边数的增减关键字

- [x] 3.1 `+` / `-` 关键字：边数步改默认值、半径步改正在预览的形状，两步都列进 `keywords`
- [x] 3.2 钳制在 3–1024，到边界停住不回绕
- [x] 3.3 半径步提示显示当前边数（「指定内接圆半径 [6 边]」），随增减更新
- [x] 3.4 单元测试：半径步 `+` 之后 `preview` 顶点数加一且仍停在半径步；边数步 `+` 之后
      提示的默认值加一；下界收到 `-` 不回绕

## 4. 宿主：文本输入路由与修饰键滚轮

- [x] 4.1 `use-stage-drafting.ts` 的 `submit`：提示接受 `text` 而不接受 `point` 时，非空文本
      原样以 `{ kind: 'text' }` 推进；排在坐标解析之前；空输入仍走 `accept`
- [x] 4.2 默认边数的会话级 ref（不写文档、不持久化）
- [x] 4.3 `compose-stage.tsx` 接上新文案键并把命令注册进内建表
- [x] 4.4 组件测试：文本步收到的是 `text` 而不是 `keyword`；`100,50` 在文本步不被当成点；
      取点步的坐标解析与从前完全一致

- [x] 4.5 `canvas-kit` 滚轮 Hook 增加可选拦截谓词：先于平移与缩放调用，返回真则不改视口
      但仍 `preventDefault`；缺席时行为完全不变
- [x] 4.6 Stage 注入谓词：一条命令在跑且当前提示列出了 `+` / `-` 时，`Alt` + 滚轮转成关键字；
      裸滚轮与 `Ctrl`/`Cmd` + 滚轮一律放行
- [x] 4.7 累加 `deltaY` 过阈值才走一格，阈值取自 `deltaMode` 的量纲，方向反转时清零
- [x] 4.8 测试：`Alt` + 滚轮改边数且视口不变；裸滚轮仍平移；`Ctrl` + 滚轮仍缩放；
      一次触控板滑动（数十个小 delta）不会走数十格；没有列出关键字时不拦截

## 4a. 只等一个数的那一步印在光标旁

- [x] 4a.1 `resolveStageDynamicInputPrompt`：光标右下角一个框，摆位复用 `absolute` 那一档
- [x] 4a.2 `awaitingTextOnly` 判据（接受文本、不取点、不选对象），宿主据它跟踪指针
- [x] 4a.3 不画十字光标（`lines` 与 `box` 都不含这一档），系统箭头照旧在场
- [x] 4a.4 端到端：指针没进过图面时不画；进来之后印「输入边数 <6>」；键入时印缓冲；
      走到中心步换回两个坐标框

## 4b. 圆角手柄收成只有矩形

- [x] 4b.1 `STAGE_RECT_PRESET_ID` 一处定义，落地挑 Preset 与手柄判据共用
- [x] 4b.2 `curveCorners` 读 `Composition.presetId`，非 `rect` 一律不出
- [x] 4b.3 端到端：多边形选中零手柄；`PLINE` 闭合出的四顶点折线同样零手柄（判别点：
      与矩形几何逐点相同）；矩形照旧四个

## 5. 工具栏

- [x] 5.1 `DRAWING_COMMANDS` 插入 `['POLYGON', 'drawPolygon', 'polygon']`，排在
      `RECTANGLE` 与 `CIRCLE` 之间
- [x] 5.2 `stage-toolbar-icons.tsx` 加六边形图标
- [x] 5.3 编辑器文案：`drawPolygon`
- [x] 5.4 更新 `default-stage-toolbar.test.tsx` 里的按钮集合断言

## 6. 端到端

- [x] 6.1 敲 `POL` → 回车用默认边数 → 取中心 → 取半径，场景树里出现一个 Curve，顶点数等于边数
- [x] 6.2 半径步键入 `C` 之后同一落点画出的形状变大（外切），命令行提示与关键字一起换
- [x] 6.3 **在非 100% 缩放下**断言顶点世界坐标——`world = (屏幕 − 视口) / zoom`，
      zoom 恒为 1 时吸没吸附看不出来
- [x] 6.4 用例显式关掉自动适配与角度约束（`angleConstraint: 'off'`）
- [x] 6.5 画完的多边形双击进入几何编辑，夹点显形（n 个顶点 + n 个段中点）
- [x] 6.6 半径步按住 `Alt` 滚一格，画布不动而预览多一条边；不按修饰键滚同样距离，画布平移

## 7. 文档

- [x] 7.1 `AGENTS.md`：绘图命令那一段补上 `POLYGON`，并记下三处有意偏离 AutoCAD 的判据
- [x] 7.2 `README.md` 若列出了绘图能力，同步

## 8. 验证

- [x] 8.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 8.2 `bun run test:e2e`
- [x] 8.3 `openspec validate add-polygon-command --strict`

## 9. 修订：档位提前到第一步，光标旁并排两个框

评审意见：「输入边数时候接下来就是输入内切还是外切，边数的输入框右边就是内切还是外切」
「就第一步骤有内切外切切换，选好后，下面的步骤就不提示模式了跟切换了」。

- [x] 9.1 `ComposeCommandPrompt` 加可选 `cursorInput: { value, toggle? }`——档位只在第一步、
      且要被 `Tab` 换，宿主就必须从提示里读出它；靠命令 id 反推是错的，宿主不认识命令内部
- [x] 9.2 第一步：`accepts` 加 `point`、`keywords` 加 `I`/`C`、声明 `cursorInput`；
      收到点即取用当前边数与档位并把该点当作中心，直接进半径步
- [x] 9.3 中心步与半径步收干净：不列 `I`/`C`、不受理（`rejected`）、不声明 `cursorInput`
- [x] 9.4 档位跨命令记住：`polygonFit` / `onPolygonFitChange`，宿主一个会话级 ref；
      同一档再按一次不回调
- [x] 9.5 文案：`inscribedChip` / `circumscribedChip`（与关键字标签分开——标签说的是切过去
      会得到什么，胶囊说的是此刻是哪一档），第一步提示改成「输入边数或指定中心点 <6>」
- [x] 9.6 呈现：`StageDynamicInputBox` 加 `variant`（方框 / 圆头胶囊）与 `adornment: 'swap'`，
      状态加 `ghost`（默认值淡下去）
- [x] 9.7 框宽估算认全角：`DYNAMIC_INPUT_CHAR_WIDTH` 是拉丁字的前进宽度，「内接」宽近两倍，
      不认的症状是文字被框边压住；纯拉丁文本的宽度逐字节不变，既有用例因此不受影响
- [x] 9.8 `Tab` 接管条件加一支：有 `toggle` 就接管并派发那个关键字。两支互斥由构造保证——
      有两个数值字段的步没有档位，有档位的步没有第二个数值字段
- [x] 9.9 宿主文本路由放宽成「提示接受 `text`」，并让**列出的关键字压过自由文本**：
      这一支会把所有文本吞掉，末尾那条关键字兜底永远够不着，症状是第一步敲 `C` 得到
      「边数必须是 3 到 1024 之间的整数」
- [x] 9.10 单元测试：第一步只列能切过去的那一档并印出胶囊；后两步既不列也不受理且形状不变；
      档位跨命令记住；第一步点一下即以那一下为中心
- [x] 9.11 组件测试：胶囊是圆头、无光标条、带换档标记；默认值是 `ghost`；`Tab` 换档且被接管；
      后两步不印胶囊、`Tab` 回到锁定/不接管；列出的关键字不被当成文本
- [x] 9.12 端到端：档位在第一步换之后同一落点画得更大（断**高度**——正六边形在落点正右方时
      两档宽度恒等）；半径步按 `Tab` 与敲 `C` 都不改变形状；第一步点一下即以那一下为中心
- [x] 9.13 键入的值不必按回车确认：取点前先把缓冲以 `text` 交给会话，被拒绝就停手不落点。
      缓冲是**这一步的待定值**而不是一句没敲完的命令——不交的症状是框上写着 4、落地是六边形；
      取点步早就不会丢缓冲（键入的值折进落点），`cursorInput` 那一档是这条规则唯一的漏网
- [x] 9.14 `AGENTS.md` 与设计稿同步

## 10. 修订后的验证

- [x] 10.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 10.2 `bun run test:e2e`
- [x] 10.3 `openspec validate add-polygon-command --strict`
