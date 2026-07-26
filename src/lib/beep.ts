// Short tones so operators hear the result without looking at the screen.
let ctx: AudioContext | null = null

function tone(freq: number, ms: number, delay = 0) {
  ctx = ctx ?? new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.15, ctx.currentTime + delay)
  osc.start(ctx.currentTime + delay)
  osc.stop(ctx.currentTime + delay + ms / 1000)
}

export const beepOk = () => tone(880, 120)
export const beepWarn = () => {
  tone(440, 100)
  tone(440, 100, 0.15)
}
export const beepError = () => tone(220, 300)
