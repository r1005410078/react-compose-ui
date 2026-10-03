export function setup(ctx) {
  const count = ctx.state(0)
  const label = ctx.computed(() => `count ${count.value}`)
  const tone = ctx.computed(() => (count.value >= 3 ? '#22c55e' : '#ef4444'))
  const step = () => {
    count.value += 1
    if (count.value < 3) setTimeout(step, 20)
  }
  setTimeout(step, 20)
  return { label, tone }
}
