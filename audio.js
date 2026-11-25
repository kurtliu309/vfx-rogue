/* Node Rogue v2 — synthesized SFX + lo-fi chiptune loop (global VFXAudio). WebAudio only. */
(function (global) {
  'use strict';
  let ac = null, master = null, musicGain = null, sfxGain = null;
  let sfxOn = true, musicOn = false, musicTimer = null, step = 0;
  function ctx() {
    if (ac) return ac;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    sfxGain = ac.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
    musicGain = ac.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
    return ac;
  }
  function tone(freq, dur, type, vol, when, slide, dest) {
    const a = ctx(); if (!a) return;
    const t0 = a.currentTime + (when || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, when, hp) {
    const a = ctx(); if (!a) return;
    const t0 = a.currentTime + (when || 0);
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = a.createBufferSource(); s.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    const g = a.createGain(); g.gain.value = vol || 0.2;
    s.connect(f); f.connect(g); g.connect(sfxGain);
    s.start(t0);
  }
  const SFX = {
    click: () => tone(880, 0.04, 'square', 0.08),
    hover: () => tone(1320, 0.02, 'square', 0.03),
    place: () => { tone(330, 0.06, 'square', 0.14); tone(660, 0.06, 'square', 0.1, 0.04); },
    remove: () => tone(440, 0.08, 'square', 0.1, 0, 180),
    error: () => { tone(180, 0.12, 'sawtooth', 0.14); tone(140, 0.16, 'sawtooth', 0.12, 0.09); },
    connect: () => tone(1046, 0.05, 'triangle', 0.1),
    cook: () => { noise(0.5, 0.12, 0, 1600); tone(110, 0.5, 'sawtooth', 0.12, 0, 440); },
    tick: () => tone(1800 + Math.random() * 300, 0.015, 'square', 0.025),
    warn: () => tone(1500, 0.05, 'square', 0.06),
    cache: () => { tone(523, 0.07, 'square', 0.14); tone(784, 0.07, 'square', 0.14, 0.06); tone(1046, 0.12, 'square', 0.14, 0.12); },
    diverge: () => { noise(0.8, 0.35, 0, 200); tone(400, 0.6, 'sawtooth', 0.2, 0, 40); },
    good: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.12, i * 0.08)); },
    great: () => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.14, 'square', 0.12, i * 0.07)); tone(2093, 0.4, 'triangle', 0.1, 0.45); },
    bad: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.16, 'triangle', 0.14, i * 0.12)); },
    cash: () => { tone(1318, 0.05, 'square', 0.1); tone(1760, 0.12, 'square', 0.1, 0.05); },
    rent: () => { tone(220, 0.1, 'square', 0.12); tone(196, 0.2, 'square', 0.12, 0.1); },
    meow: () => { tone(700, 0.18, 'triangle', 0.12, 0, 1100); tone(1000, 0.22, 'triangle', 0.1, 0.16, 600); },
    page: () => noise(0.08, 0.08, 0, 3000),
    notify: () => { tone(988, 0.08, 'square', 0.08); tone(1318, 0.12, 'square', 0.08, 0.08); },
    buy: () => { tone(784, 0.06, 'square', 0.12); tone(1175, 0.1, 'square', 0.12, 0.05); }
  };
  function play(name) { if (!sfxOn) return; try { const a = ctx(); if (a && a.state === 'suspended') a.resume(); (SFX[name] || SFX.click)(); } catch (e) { /* ignore */ } }

  // lo-fi chiptune: i–VI–III–VII in A minor, swung 16ths
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function musicTick() {
    const a = ctx(); if (!a || !musicOn) return;
    const bar = Math.floor(step / 16) % 4, s = step % 16;
    const ch = CHORDS[bar];
    if (s % 8 === 0) tone(mtof(ch[0] - 24), 0.5, 'triangle', 0.25, 0, null, musicGain);
    if (s % 4 === 2) tone(mtof(ch[0] - 12), 0.18, 'triangle', 0.12, 0, null, musicGain);
    if (s % 2 === 0) { const n = ch[(s / 2) % 3] + (s >= 8 ? 12 : 0); tone(mtof(n), 0.12, 'square', 0.05, 0, null, musicGain); }
    if (s === 4 || s === 12) noise(0.05, 0.05, 0, 5000);
    if (s === 0 || s === 10) { const k = a.createOscillator(), g = a.createGain(); k.frequency.setValueAtTime(120, a.currentTime); k.frequency.exponentialRampToValueAtTime(40, a.currentTime + 0.12); g.gain.setValueAtTime(0.3, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.15); k.connect(g); g.connect(musicGain); k.start(); k.stop(a.currentTime + 0.16); }
    if (bar === 3 && s === 14) tone(mtof(ch[2] + 12), 0.3, 'square', 0.04, 0, null, musicGain);
    step++;
  }
  function setMusic(on) {
    musicOn = !!on;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (musicOn) { const a = ctx(); if (a && a.state === 'suspended') a.resume(); musicTimer = setInterval(musicTick, 135); }
  }
  function setSfx(on) { sfxOn = !!on; }
  global.VFXAudio = { play, setMusic, setSfx, get music() { return musicOn; }, get sfx() { return sfxOn; } };
})(typeof window !== 'undefined' ? window : globalThis);
