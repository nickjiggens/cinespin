// Canvas-based Movie Picker Wheel with inertia physics, peg deflection, and Web Audio ticks
import { sounds } from './audio.js';

export class MovieWheel {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.movies = [];
    this.onFinish = options.onFinish || (() => {});
    this.onSelectChange = options.onSelectChange || (() => {});

    // Wheel physics state
    this.currentAngle = 0; // in radians
    this.angularVelocity = 0; // rad/frame
    this.friction = 0.988; // smooth deceleration
    this.isSpinning = false;
    this.animationFrame = null;
    this.lastPegIndex = -1;

    // Needle physics
    this.needleAngle = 0; // deflection in radians
    this.needleVelocity = 0;

    // Rich cinematic slice color palette (16 distinct colors for dense wheels)
    this.colors = [
      '#e63946', '#2a9d8f', '#f4a261', '#457b9d',
      '#7209b7', '#3a0ca3', '#4361ee', '#f72585',
      '#06d6a0', '#118ab2', '#e76f51', '#588157',
      '#d90429', '#00b4d8', '#9b5de5', '#fb8500'
    ];

    if (this.canvas) {
      this.setupCanvas();
      window.addEventListener('resize', () => {
        this.setupCanvas();
        this.draw();
      });
    }
  }

  setupCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Set actual canvas pixels to match display size * DPR for razor-sharp rendering
    const size = Math.min(rect.width || 460, 560);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.ctx.scale(dpr, dpr);
    this.displaySize = size;
  }

  setMovies(movies) {
    this.movies = movies;
    this.draw();
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    const size = this.displaySize || 460;
    const center = size / 2;
    const radius = center - 24;

    this.ctx.clearRect(0, 0, size, size);

    if (!this.movies || this.movies.length === 0) {
      // Empty state placeholder
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(center, center, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#161b2e';
      this.ctx.fill();
      this.ctx.strokeStyle = '#2d3748';
      this.ctx.lineWidth = 4;
      this.ctx.stroke();

      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '600 16px "Outfit", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('Select a list to load movies', center, center);
      this.ctx.restore();
      return;
    }

    const numSlices = this.movies.length;
    const arc = (Math.PI * 2) / numSlices;

    this.ctx.save();
    this.ctx.translate(center, center);
    this.ctx.rotate(this.currentAngle);

    // 1. Draw Slices
    for (let i = 0; i < numSlices; i++) {
      const angle = i * arc;
      const movie = this.movies[i];
      const color = this.colors[i % this.colors.length];

      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.arc(0, 0, radius, angle, angle + arc);
      this.ctx.lineTo(0, 0);

      // Slice background with subtle radial gradient for depth
      const grad = this.ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
      grad.addColorStop(0, color);
      grad.addColorStop(1, this.adjustBrightness(color, -25));
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      // Slice border
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // Slice text
      this.ctx.save();
      this.ctx.rotate(angle + arc / 2);
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = '#ffffff';

      // Smart font sizing depending on count
      let fontSize = numSlices > 22 ? 9 : numSlices > 16 ? 10.5 : numSlices > 11 ? 12 : 14;
      this.ctx.font = `600 ${fontSize}px "Outfit", sans-serif`;
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      this.ctx.shadowBlur = 3;
      this.ctx.shadowOffsetX = 1;
      this.ctx.shadowOffsetY = 1;

      // Truncate long titles cleanly
      const hubAvoidance = numSlices > 20 ? 0.32 : 0.38;
      const maxTextWidth = radius - (radius * hubAvoidance);
      let title = movie.title;
      if (this.ctx.measureText(title).width > maxTextWidth) {
        while (title.length > 3 && this.ctx.measureText(title + '...').width > maxTextWidth) {
          title = title.slice(0, -1);
        }
        title += '...';
      }

      this.ctx.fillText(title, radius - 14, 0);
      this.ctx.restore();
    }

    // 2. Draw Outer Rim & Studs (Pegs)
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#ffd166';
    this.ctx.lineWidth = 6;
    this.ctx.stroke();

    for (let i = 0; i < numSlices; i++) {
      const pegAngle = i * arc;
      const px = Math.cos(pegAngle) * radius;
      const py = Math.sin(pegAngle) * radius;

      this.ctx.beginPath();
      this.ctx.arc(px, py, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fill();
      this.ctx.strokeStyle = '#e5a100';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    // 3. Draw Center Hub
    const hubRadius = radius * 0.22;
    const hubGrad = this.ctx.createRadialGradient(0, 0, 2, 0, 0, hubRadius);
    hubGrad.addColorStop(0, '#2d3748');
    hubGrad.addColorStop(0.7, '#1a202c');
    hubGrad.addColorStop(1, '#0f172a');

    this.ctx.beginPath();
    this.ctx.arc(0, 0, hubRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = hubGrad;
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffd166';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    // Center icon (Film reel / star)
    this.ctx.font = '22px "Outfit", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = '#ffd166';
    this.ctx.fillText('🎬', 0, 1);

    this.ctx.restore();

    // 4. Draw Indicator Pointer / Flapper at Top (pointing Down toward center)
    this.drawPointer(center, center - radius + 4);
  }

  drawPointer(x, y) {
    this.ctx.save();
    this.ctx.translate(x, y);
    // Apply dynamic deflection angle
    this.ctx.rotate(this.needleAngle);

    // Glowing drop shadow
    this.ctx.shadowColor = 'rgba(255, 51, 102, 0.7)';
    this.ctx.shadowBlur = 10;

    // Arrow pointer pointing downwards into the wheel
    this.ctx.beginPath();
    this.ctx.moveTo(0, 26);
    this.ctx.lineTo(-13, -10);
    this.ctx.lineTo(13, -10);
    this.ctx.closePath();

    const arrowGrad = this.ctx.createLinearGradient(-13, -10, 13, 26);
    arrowGrad.addColorStop(0, '#ff3366');
    arrowGrad.addColorStop(1, '#ff6b8b');
    this.ctx.fillStyle = arrowGrad;
    this.ctx.fill();

    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Needle anchor pin
    this.ctx.beginPath();
    this.ctx.arc(0, -6, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffd166';
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.restore();
  }

  spin() {
    if (this.isSpinning || !this.movies || this.movies.length < 2) return;
    this.isSpinning = true;

    sounds.playSpinStart();

    // Randomize spin intensity: 5-8 full spins + random offset
    const baseSpins = 5 + Math.random() * 3;
    const targetOffset = Math.random() * Math.PI * 2;
    // Initial velocity calibrated with friction
    this.angularVelocity = 0.28 + Math.random() * 0.12;

    this.lastPegIndex = -1;
    this.animate();
  }

  animate() {
    if (!this.isSpinning) return;

    // Update wheel angle
    this.currentAngle += this.angularVelocity;
    this.currentAngle = this.currentAngle % (Math.PI * 2);

    // Deceleration
    this.angularVelocity *= this.friction;

    // Calculate peg collision with top pointer (top is at -PI/2 or 3PI/2 in standard coords)
    if (this.movies && this.movies.length > 0) {
      const numSlices = this.movies.length;
      const arc = (Math.PI * 2) / numSlices;
      // Wheel rotated by currentAngle; pointer is fixed at top (angle -Math.PI / 2)
      // Relative angle under pointer:
      const relativeAngle = (Math.PI * 1.5 - this.currentAngle + Math.PI * 2) % (Math.PI * 2);
      const currentPeg = Math.floor(relativeAngle / arc);

      if (currentPeg !== this.lastPegIndex) {
        this.lastPegIndex = currentPeg;
        // Trigger peg sound with pitch modulated by speed
        const speedNorm = Math.min(1.5, Math.max(0.6, this.angularVelocity * 10));
        sounds.playTick(speedNorm);
        // Deflect needle in direction of spin
        this.needleAngle = 0.28;
      }
    }

    // Needle spring return animation
    this.needleAngle *= 0.82;

    this.draw();

    // Check if stopped
    if (this.angularVelocity < 0.0018) {
      this.isSpinning = false;
      this.angularVelocity = 0;
      this.needleAngle = 0;
      this.draw();

      const winner = this.getCurrentWinner();
      if (winner) {
        this.onFinish(winner);
      }
      return;
    }

    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  getCurrentWinner() {
    if (!this.movies || this.movies.length === 0) return null;
    const numSlices = this.movies.length;
    const arc = (Math.PI * 2) / numSlices;
    // Pointer is at the top (-PI/2 or 3PI/2)
    const relativeAngle = (Math.PI * 1.5 - this.currentAngle + Math.PI * 2) % (Math.PI * 2);
    const winningIndex = Math.floor(relativeAngle / arc) % numSlices;
    return this.movies[winningIndex];
  }

  adjustBrightness(hex, percent) {
    let num = parseInt(hex.replace('#', ''), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      G = (num >> 8 & 0x00FF) + amt,
      B = (num & 0x0000FF) + amt;
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  }
}
