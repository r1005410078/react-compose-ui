export function setup(ctx) {
  // eslint-disable-next-line no-undef -- 夹具故意访问浏览器全局：Qt 里没有它，验证 setup 抛错时画面保持静态值
  const title = ctx.state(document.title)
  return { title, tone: ctx.state('#22c55e') }
}
