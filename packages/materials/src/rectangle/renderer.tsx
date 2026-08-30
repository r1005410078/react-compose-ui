/**
 * Materials 内置 Panel renderer。
 *
 * @remarks
 * 盒里那行占位文案跟着面向用户的名字走——画布上一块写着「Rectangle」的面板，与物料面板里的
 * 「矩形」（那个是曲线）说的是两件事，而用户只看得见这行字。
 *
 * `data-testid` 与 CSS 类名沿用 `rectangle`：它们是协议那一层的 id，改了等于让既有用例与
 * 样式一起失准，而名字是面向用户的那一层。
 *
 * @internal
 */
export function RectangleRenderer() {
  return (
    <div
      className="compose-material compose-material--rectangle"
      data-testid="compose-material-rectangle"
    >
      Panel
    </div>
  )
}
