# 变更：基本类型数组可以整列录入

## 原因

数组字段在面板上一项一格，加第 5 个点要先点一次「添加」再填
（`docs/dashboard-dogfood-issues.md` 的 M-2）。一周七天的收益要点 3 次「添加」再填 7 次，
而这串数几乎总是**从别处复制来的一列**——表格、CSV、某个接口的返回。没有任何入口能把一列
数一次贴进去。

这不是图表物料的问题：任何 `array(number)` / `array(string)` 字段都一样。因此入口做在
`property-panel` 的数组分组上，图表只是第一个消费者。

## 变更内容

- 基本类型（number / string）数组的分组多一个「批量编辑」动作，打开一块文本区：**一行一项**，
  确认后整体替换该数组。
- 分隔符收三种：换行、制表符、逗号——从表格里复制**一列**得到换行，复制**一行**得到制表符，
  从 CSV 粘来得到逗号。
- 非法行**整体拒绝并指出是第几行**，MUST NOT 静默丢弃：静默丢弃会让用户贴进 20 个数、
  看到 18 个，而屏幕上没有任何东西说明少掉的是哪两个。
- 非基本类型的数组不出这个入口——「一行一个对象」没有意义。

## 影响

- 受影响的规范：`property-panel`
- 受影响的代码：
  - `packages/property-panel/src/property-tree.tsx`（数组分组的动作与批量编辑面）
  - `packages/property-panel/src/property-panel-i18n.ts`（文案）
  - `packages/property-panel/src/styles.css`
