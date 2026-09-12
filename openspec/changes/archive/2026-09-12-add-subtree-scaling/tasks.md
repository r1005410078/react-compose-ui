# 任务：组件实例的内容缩放

- [x] 1.1 component-instance props 新增 `contentFit`（`'layout' | 'scale'`，默认 `'layout'`）
      与 prop contract；Inspector 呈现。自定义 Inspector 按 `propCategory` 每分类渲染一次，
      字段必须按分类过滤——不过滤的症状是同一个下拉在「动画」与「内容」两组里各画一遍
- [x] 1.2 `'scale'` 下渲染：外层按盒与组件根尺寸的两轴比值做 CSS transform，
      `transform-origin` 取左上角；嵌套文档尺寸不变。宿主盒由 Renderer 量自己的 DOM
      （`getComputedStyle` + ResizeObserver）——量 `getBoundingClientRect` 会把画布 zoom
      乘进比值、内容被双重缩放
- [x] 1.3 `'scale'` 下 resize MUST NOT 走 `alignComponentDocumentOutput` 那条改写嵌套根
      Frame 尺寸的路径；两支互斥的用例。**不是放行默认 setTransform 而是拦截后直写宿主
      LayoutItem**：已落盘的旧实例宿主可能是 `resize: 'none'`，默认路径会拒绝，而 Stage 的
      手柄推导对实例强制按 `free` 处理，写入侧必须与它一致。Inspector 的尺寸编辑同理直落
      宿主（值改了而模式没动时 coerce 成 fixed——留在 hug 会被测量改回去，屏幕上没有变化）
- [x] 1.4 既有实例（无该 prop）行为逐像素不变的用例（DOM 判别：`'layout'` 分支不出现缩放
      包装层）
- [x] 1.5 端到端：`'scale'` 下拖角手柄，内部绝对定位子级跟着放大；只拖宽时纵向纹丝不动
      （非等比两轴各自缩放）。互斥判别读「覆盖写到哪儿」：`'scale'` 拖完 Apply 入口保持
      不可用（无嵌套覆盖），切回 `'layout'` 再拖即变为可用
- [x] 1.6 端到端：下钻选中放大后实例内部的 Entity，选中框与缩放后的图形对齐
      （`stage-instance-selection-bounds` 与 DOM 盒之差 < 1.5px）
- [x] 1.7 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`

> 1.5 与 1.6 落成 Playwright 端到端而不是 jsdom 组件测试：断言的是真实布局与 DOM 测量
> （jsdom 量不出盒），按仓库测试分层「真实布局用 Playwright」。jsdom 侧补的是纯函数比值、
> 缩放包装层结构与 controller 两条写入路径的单测。

> 已知欠账（不在本变更内）：`'scale'` 实例上组件根声明的**端口**未按比值缩放——特征点捕捉与
> 导线求解仍按组件根坐标读 `position`，符号放大后端口停在原坐标上。修它需要给 core 的端口
> 读取入口带上盒尺寸（`resolveComposePortPoint` 与 feature-points 两处消费），而 core 不认识
> materials 的 Renderer prop，先要回答「缩放判据放在哪一层」。
