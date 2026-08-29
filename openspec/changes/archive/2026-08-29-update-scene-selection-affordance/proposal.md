# 变更：场景体不再承担选中与拖动，边界改由 chrome 表达

## 原因

场景（`rootIds` 直接成员的 Frame）今天有三条把整块场景搬走的路径：空场景不参与命中收敛、
已在选区内的场景不参与命中收敛、以及从工作区往回拖的窗交框蹭到场景边缘就把它选中。子级是
相对坐标，场景被搬走时画面内部没有任何变化，用户要过很久才发现，那时已经撤销不回来了。

同时场景默认背景与 Container 默认背景同色（`#1e2229`），与工作区底色（`#11151b`）只差不到
5% 明度且默认无边框——用户读不出场景边界在哪，以为自己在工作区空白处操作，实际早已在场景里。
这是误触的另一半原因。

调研过的产品里，只有 Sketch 没有这类长期报障：场景体永不承担选中，入口是标题与一个显式修饰
键。Figma 把场景体本身当入口，"Stop frames from accidentally moving around" 是它的长青投诉帖；
Miro 的隐形边框拖动带同样在报障。

## 变更内容

- **BREAKING** 顶层容器体的命中收敛去掉两条例外：空容器与已在选区内的容器同样收敛为框选。
  场景体在任何情况下都不再是选中或拖动入口。
- 新增 `⌘/Ctrl + 场景体` 直选并拖动场景，作为标题标签之外的第二个入口。
- **BREAKING** 框选结果 MUST NOT 含任何顶层 Frame，不再只排除"完全包住框选区"的那一种。
- **BREAKING** 场景默认外观的背景改为透明，与 Container 默认背景脱钩——背景由用户决定，
  编辑器不替他先填一个颜色。既有文档不迁移。
- **BREAKING** Stage 为每块场景绘制恒定 1px 屏幕宽度的编辑器边界描边。透明背景之后边界只能
  由 chrome 承担；这推翻"Stage MUST NOT 为 Frame 额外绘制描边"。

## 影响

- 受影响的规范：`stage-engine`、`stage`、`compose-document`、`basic-materials`
- 受影响的代码：
  - `packages/stage-engine/src/interaction-kernel/marquee-plugin.ts`（`shouldConvergeToMarquee`）
  - `packages/stage-engine/src/interaction-kernel/move-plugin.ts`（⌘ 直选分支）
  - `packages/stage-engine/src/hit-testing/marquee-selection.ts`（Frame 排除）
  - `packages/core/src/frame.ts`（`COMPOSE_DEFAULT_SCENE_APPEARANCE`）
  - `packages/stage/src/stage-surface/screen-model/stage-world-underlay.tsx` 与 `styles.css`
