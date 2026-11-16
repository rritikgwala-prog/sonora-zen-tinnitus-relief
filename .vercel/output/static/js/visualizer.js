/**
 * Sonora Zen - 60FPS Luminous Canvas Visualizer
 * Dual Mode: "Zen Aura" (Hypnotic Breathing Orb) & "Neuro Spectrum" (Silky Gradient Wave with Notch Marker)
 */

class AudioVisualizer {
  constructor(canvasId, audioEngine) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.audio = audioEngine;
    
    this.mode = 'aura'; // 'aura' or 'spectrum'
    this.animationId = null;
    this.dpr = window.devicePixelRatio || 1;
    this.phase = 0;

    // Particles for Zen Aura
    this.particles = [];
    this.initParticles(35);

    // Bind resize
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.handleResize();

    // Start loop
    this.render = this.render.bind(this);
    this.start();
  }

  initParticles(count) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        angle: Math.random() * Math.PI * 2,
        dist: 40 + Math.random() * 80,
        speed: 0.003 + Math.random() * 0.008,
        size: 1 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.6,
        pulseSpeed: 0.02 + Math.random() * 0.03
      });
    }
  }

  handleResize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
  }

  setMode(mode) {
    this.mode = mode;
  }

  start() {
    if (!this.animationId) {
      this.render();
    }
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  render() {
    this.animationId = requestAnimationFrame(this.render);

    const w = this.width;
    const h = this.height;
    if (!w || !h) return;

    // Clear with slight trailing fade for smooth glow trails
    this.ctx.clearRect(0, 0, w, h);

    const isPlaying = this.audio && this.audio.isPlaying;
    let freqData = new Uint8Array(128);

    if (isPlaying && this.audio.analyser) {
      this.audio.analyser.getByteFrequencyData(freqData);
    }

    // Compute average energy
    let sum = 0;
    for (let i = 0; i < freqData.length; i++) {
      sum += freqData[i];
    }
    const avgEnergy = sum / freqData.length;
    const normEnergy = Math.min(1, avgEnergy / 80);

    this.phase += 0.02 + normEnergy * 0.03;

    if (this.mode === 'aura') {
      this.renderZenAura(w, h, freqData, normEnergy);
    } else {
      this.renderNeuroSpectrum(w, h, freqData, normEnergy);
    }
  }

  /**
   * Mode 1: Hypnotic Luminous Breathing Orb
   */
  renderZenAura(w, h, freqData, energy) {
    const cx = w / 2;
    const cy = h / 2;
    const baseRadius = Math.min(w, h) * 0.22;
    const expansion = energy * 25;
    const currentRadius = baseRadius + expansion + Math.sin(this.phase) * 6;

    // Outer Glow / Radial Blur
    const gradGlow = this.ctx.createRadialGradient(cx, cy, currentRadius * 0.3, cx, cy, currentRadius * 2.2);
    gradGlow.addColorStop(0, 'rgba(56, 189, 248, 0.25)'); // Cyan glow
    gradGlow.addColorStop(0.5, 'rgba(129, 140, 248, 0.15)'); // Indigo
    gradGlow.addColorStop(0.8, 'rgba(168, 85, 247, 0.05)'); // Purple
    gradGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

    this.ctx.fillStyle = gradGlow;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, currentRadius * 2.2, 0, Math.PI * 2);
    this.ctx.fill();

    // Organic dynamic ripple rings
    const rings = 3;
    for (let r = 0; r < rings; r++) {
      const ringRadius = currentRadius * (0.85 + r * 0.35) + Math.cos(this.phase + r) * 8;
      this.ctx.beginPath();
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 - r * 0.12})`;
      this.ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Floating calming ambient particles
    this.particles.forEach(p => {
      p.angle += p.speed;
      const r = currentRadius + p.dist * (1 + energy * 0.4);
      const px = cx + Math.cos(p.angle) * r;
      const py = cy + Math.sin(p.angle) * r;

      this.ctx.beginPath();
      this.ctx.fillStyle = `rgba(165, 243, 252, ${p.alpha})`;
      this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Core Solid Breathing Pearl
    const coreGrad = this.ctx.createRadialGradient(cx - currentRadius * 0.2, cy - currentRadius * 0.2, 5, cx, cy, currentRadius);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    coreGrad.addColorStop(0.3, 'rgba(186, 230, 253, 0.8)');
    coreGrad.addColorStop(0.7, 'rgba(99, 102, 241, 0.7)');
    coreGrad.addColorStop(1, 'rgba(30, 27, 75, 0.9)');

    this.ctx.save();
    this.ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
    this.ctx.shadowBlur = 24 + energy * 30;
    this.ctx.fillStyle = coreGrad;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Center subtle Zen pulse icon
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 6 + energy * 4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Mode 2: Ultra-smooth Bézier Gradient Spectrum with Tinnitus Notch Indicator
   */
  renderNeuroSpectrum(w, h, freqData, energy) {
    const points = [];
    const count = 48; // Sample points
    const step = w / (count - 1);

    for (let i = 0; i < count; i++) {
      const dataIdx = Math.floor((i / count) * (freqData.length * 0.65));
      const val = freqData[dataIdx] || 0;
      const heightFrac = (val / 255);
      const wave = Math.sin(this.phase * 2 + i * 0.25) * 6;
      const y = h - 20 - (heightFrac * (h * 0.72) + wave + (this.audio.isPlaying ? 10 : 2));
      points.push({ x: i * step, y: Math.min(h - 10, Math.max(20, y)) });
    }

    // Draw Smooth Wave Area
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    this.ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    this.ctx.lineTo(w, h);
    this.ctx.lineTo(0, h);
    this.ctx.closePath();

    // Gradient Fill
    const grad = this.ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.25)'); // Emerald (deep bass)
    grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.35)'); // Cyan (mids)
    grad.addColorStop(1, 'rgba(168, 85, 247, 0.25)'); // Purple (highs)

    this.ctx.fillStyle = grad;
    this.ctx.fill();

    // Radiant Top Stroke Line
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    this.ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

    const strokeGrad = this.ctx.createLinearGradient(0, 0, w, 0);
    strokeGrad.addColorStop(0, '#10b981');
    strokeGrad.addColorStop(0.5, '#38bdf8');
    strokeGrad.addColorStop(1, '#a855f7');

    this.ctx.save();
    this.ctx.shadowColor = '#38bdf8';
    this.ctx.shadowBlur = 12;
    this.ctx.lineWidth = 2.5;
    this.ctx.strokeStyle = strokeGrad;
    this.ctx.stroke();
    this.ctx.restore();

    // Tinnitus Notch Indicator Line (if Notch Therapy is active)
    if (this.audio && this.audio.isNotchActive && this.audio.tinnitusFrequency) {
      const freq = this.audio.tinnitusFrequency;
      // Map freq logarithmically across width (200Hz to 16000Hz)
      const minLog = Math.log10(200);
      const maxLog = Math.log10(16000);
      const currentLog = Math.log10(Math.max(200, Math.min(16000, freq)));
      const notchX = ((currentLog - minLog) / (maxLog - minLog)) * w;

      // Glow notch beam
      this.ctx.save();
      this.ctx.setLineDash([4, 4]);
      this.ctx.strokeStyle = '#f43f5e'; // Rose pink
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = '#f43f5e';
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.moveTo(notchX, 10);
      this.ctx.lineTo(notchX, h - 5);
      this.ctx.stroke();

      // Notch Badge Tag
      this.ctx.fillStyle = '#f43f5e';
      this.ctx.font = '600 11px system-ui, sans-serif';
      this.ctx.fillText(`NOTCH: ${freq} Hz`, Math.min(w - 110, Math.max(10, notchX - 45)), 25);
      this.ctx.restore();
    }
  }
}

window.AudioVisualizer = AudioVisualizer;
