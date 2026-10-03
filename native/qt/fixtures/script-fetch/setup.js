export function setup(ctx) {
  const reading = ctx.state('loading')
  const tone = ctx.state('#ef4444')
  ctx.effect(() => {
    fetch('data.json')
      .then((response) => response.json())
      .then((data) => {
        reading.value = `${data.value} ${data.unit}`
        tone.value = data.ok ? '#22c55e' : '#ef4444'
      })
  })
  return { reading, tone }
}
