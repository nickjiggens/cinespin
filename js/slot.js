// Alternative Film Strip / Slot Reel Spinner for quick spins
import { sounds } from './audio.js';

export class SlotReelSpinner {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.movies = [];
    this.onFinish = options.onFinish || (() => {});
    this.isSpinning = false;
  }

  setMovies(movies) {
    this.movies = movies;
    this.render();
  }

  render() {
    if (!this.container) return;
    if (!this.movies || this.movies.length === 0) {
      this.container.innerHTML = `<div class="slot-placeholder">Select a list to load movies</div>`;
      return;
    }

    // Build the visual film strip reel
    this.container.innerHTML = `
      <div class="slot-window">
        <div class="slot-highlight-bar"></div>
        <div class="slot-strip" id="slotStrip">
          ${this.movies.map(m => `
            <div class="slot-card" data-id="${m.id}">
              <div class="slot-card-title">${m.title}</div>
              <div class="slot-card-meta">${m.year} • ${m.runtime} • ${m.genre}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  spin() {
    if (this.isSpinning || !this.movies || this.movies.length === 0) return;
    this.isSpinning = true;

    sounds.playSpinStart();

    const strip = document.getElementById('slotStrip');
    if (!strip) return;

    // Pick winner in advance
    const winnerIndex = Math.floor(Math.random() * this.movies.length);
    const winner = this.movies[winnerIndex];

    // Card height in pixels (matches CSS: 70px)
    const cardHeight = 70;
    const totalItems = this.movies.length;
    // Repeat cycles to simulate fast blur
    const cycles = 4;
    const targetY = (cycles * totalItems + winnerIndex) * cardHeight;

    // Build an elongated strip for smooth continuous rolling
    let repeatedHtml = '';
    for (let c = 0; c <= cycles + 1; c++) {
      repeatedHtml += this.movies.map(m => `
        <div class="slot-card">
          <div class="slot-card-title">${m.title}</div>
          <div class="slot-card-meta">${m.year} • ${m.runtime} • ${m.genre}</div>
        </div>
      `).join('');
    }
    strip.innerHTML = repeatedHtml;
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0px)';

    // Trigger tick sounds at intervals
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      tickCount++;
      sounds.playTick(1.2);
      if (tickCount > 24) clearInterval(tickInterval);
    }, 120);

    // Force reflow
    void strip.offsetHeight;

    // Animate to target
    strip.style.transition = 'transform 3.8s cubic-bezier(0.12, 0.8, 0.22, 1)';
    strip.style.transform = `translateY(-${targetY}px)`;

    setTimeout(() => {
      this.isSpinning = false;
      this.onFinish(winner);
    }, 3900);
  }
}
