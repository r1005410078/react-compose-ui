# 任务：几何编辑会话内插入与删除顶点

- [x] 1.1 `core`：三次贝塞尔的 de Casteljau 分割（给定 `t` 分成两段，形状不变）与单测
- [x] 1.2 `stage-engine`：段上落点 → 插入顶点的纯函数，覆盖 `line`（同时换 kind 成 `polyline`）、
      `polyline`（含闭合的收尾段）与 `path`（分割那一段）
- [x] 1.3 `stage-engine`：删除顶点的纯函数，相邻段合并；下限校验（每条轮廓至少两个顶点）
- [x] 1.4 弧不受理，两个操作都以 `rejected` 说明
- [x] 1.5 `stage`：会话内双击段触发插入，落点走既有解算（吸附/捕捉/动态输入照旧）
- [x] 1.6 `stage`：会话内有夹点被作用着时 `Delete`/`Backspace` 删顶点；否则照旧删 Entity 的
      分级用例
- [x] 1.7 写入走 `entity.curve.set`，撤销一步回到原几何与原 kind
- [x] 1.8 端到端：矩形上双击一条边加点、拖走；再删掉它回到四顶点
- [x] 1.9 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`

> 1.1 落地时发现 `splitCubic` **已经在 `core/curve-geometry.ts` 里**（`flattenComposeCubic`
> 按 `t = 0.5` 递归时就在用它），因此这一条实际是把它导出成 `splitComposeCubic` 并补上
> `nearestComposeCubicT`——后者与 `pointToComposeCubicDistance` **共用同一条细分**，否则
> 「点在这条曲线上」与「它落在参数 t 处」会给出互相矛盾的答案。
>
> 1.2 多出一条 `path-seam` 拒绝：闭合子路径的收尾直段是展开时补出来的，数据里没有这一段。
> 静默插到最近的**显式**段上是更坏的答案——用户双击了这里，顶点出现在那里。规范增量已补。
>
> 1.5 的落点判定分两处：**哪个 Entity** 由指针命中给出（插件读 `geometryEditingId` 判断会话
> 已经开在它身上），**是不是真的落在一条段上**由宿主拿轮廓与 `COMPOSE_CURVE_PICK_TOLERANCE`
> 比——填过色的曲线内部同样命中，而它的中间没有段。判定留在世界空间，与点选、框选同一条链。
>
> 1.8 的端到端里有一处**必须真的等一次连击间隔**：点亮前的上一次按下落在几乎同一个位置，
> 浏览器会把这一下算进那条连击，而「连击中的那一下不点亮」是刻意的。
