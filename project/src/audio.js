export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.enabled = true
    this._unlocked = false
  }

  _ensure() {
    if (this.ctx) return this.ctx
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.55
      this.master.connect(this.ctx.destination)
      return this.ctx
    } catch { return null }
  }

  unlock() {
    const c = this._ensure()
    if (!c) return
    if (c.state === 'suspended') c.resume()
    this._unlocked = true
  }

  _tone(freq, type, dur, gain, slide) {
    const c = this._ensure()
    if (!c || !this.enabled) return
    if (c.state === 'suspended') c.resume().catch(()=>{})
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.value = freq
    if (slide) {
      o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + dur * 0.9)
    }
    g.gain.value = gain
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur)
    o.connect(g).connect(this.master)
    o.start()
    o.stop(c.currentTime + dur)
  }

  _noise(dur, gain, hp=800) {
    const c = this._ensure()
    if (!c || !this.enabled) return
    if (c.state === 'suspended') c.resume().catch(()=>{})
    const buffer = c.createBuffer(1, c.sampleRate * dur, c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i=0;i<data.length;i++) data[i]=(Math.random()*2-1) * Math.pow(1 - i/data.length, 1.2)
    const src = c.createBufferSource()
    src.buffer = buffer
    const filter = c.createBiquadFilter()
    filter.type='highpass'; filter.frequency.value = hp
    const g = c.createGain()
    g.gain.value = gain
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur)
    src.connect(filter).connect(g).connect(this.master)
    src.start()
  }

  shoot() {
    this._tone(180, 'square', 0.08, 0.65, 60)
    this._noise(0.12, 0.9, 1200)
    // click
    setTimeout(()=> this._tone(90, 'square', 0.05, 0.3), 20)
  }
  hit() {
    this._tone(620, 'sine', 0.09, 0.5, 880)
  }
  hitEnemy() {
    this._tone(320, 'square', 0.07, 0.45, 150)
    this._noise(0.06, 0.3, 2000)
  }
  reload() {
    this._tone(500, 'triangle', 0.12, 0.35, 300)
    setTimeout(()=> this._tone(700, 'triangle', 0.15, 0.35, 400), 180)
    setTimeout(()=> this._tone(950, 'sine', 0.08, 0.25), 480)
  }
  reloadDone() {
    this._tone(1100, 'sine', 0.14, 0.4, 1300)
  }
  hurt() {
    this._tone(140, 'sawtooth', 0.35, 0.5, 70)
    this._noise(0.2, 0.4, 400)
  }
  kill() {
    this._tone(440, 'sine', 0.12, 0.45, 660)
    setTimeout(()=> this._tone(880, 'sine', 0.18, 0.4), 110)
  }
  wave() {
    this._tone(300, 'sine', 0.4, 0.35, 600)
    setTimeout(()=> this._tone(600, 'sine', 0.5, 0.35, 900), 250)
  }
  win() {
    [0,150,300,450].forEach((d,i)=> setTimeout(()=> this._tone(400+i*100,'sine',0.4,0.35,500+i*80), d))
  }
  die() {
    this._tone(200,'sawtooth',1.2,0.5,40)
  }
  step(isSprint){
    this._tone(isSprint? 90:70,'square',0.04,0.08)
  }
}
export const audio = new AudioEngine()
