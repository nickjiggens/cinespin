// Main Application Controller for QuickerMoviePickerSpinnerUpper
import { PRESET_LISTS, MOVIE_CATEGORIES } from './movies-data.js';
import { sounds } from './audio.js';
import { ConfettiCannon } from './confetti.js';
import { MovieWheel } from './wheel.js';
import { SlotReelSpinner } from './slot.js';

class MoviePickerApp {
  constructor() {
    this.categories = MOVIE_CATEGORIES;
    this.presetLists = PRESET_LISTS;
    this.customLists = this.loadCustomLists();
    this.history = this.loadHistory();

    // App state
    this.currentCategoryId = 'our-list';
    this.currentListId = 'nick-gf-movies'; // default to Nick & GF Google Doc list
    this.activeMovies = [];
    this.disabledMovieIds = new Set();
    this.maxRuntimeFilter = 'all'; // 'all', '100', '120'
    this.spinnerMode = 'wheel'; // 'wheel' | 'slot'
    this.currentWinner = null;
    this.randomScope = 'all'; // 'all' or 'category'
    this.isShufflingList = false;
    this.rouletteTimer = null;

    // Component instances
    this.wheel = null;
    this.slot = null;
    this.confetti = null;

    this.init();
  }

  init() {
    // Instantiate Confetti
    this.confetti = new ConfettiCannon('confettiCanvas');

    // Instantiate Spinners
    this.wheel = new MovieWheel('wheelCanvas', {
      onFinish: (winner) => this.handleSpinComplete(winner)
    });

    this.slot = new SlotReelSpinner('slotReelContainer', {
      onFinish: (winner) => this.handleSpinComplete(winner)
    });

    // Setup DOM Listeners & UI
    this.setupEventListeners();
    this.renderCategoryTabs();
    this.renderListSelector();
    this.loadActiveList();
    this.updateAudioButtonState();
    this.renderHistoryBadge();
  }

  // --- LOCAL STORAGE HELPERS ---
  loadCustomLists() {
    try {
      const stored = localStorage.getItem('cinespin_custom_lists');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  saveCustomLists() {
    try {
      localStorage.setItem('cinespin_custom_lists', JSON.stringify(this.customLists));
    } catch (e) {}
  }

  loadHistory() {
    try {
      const stored = localStorage.getItem('cinespin_history');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  saveHistory() {
    try {
      localStorage.setItem('cinespin_history', JSON.stringify(this.history));
    } catch (e) {}
  }

  // --- LIST RETRIEVAL ---
  getAllLists() {
    return [...this.presetLists, ...this.customLists];
  }

  getCurrentList() {
    const all = this.getAllLists();
    return all.find(l => l.id === this.currentListId) || this.presetLists[0];
  }

  // --- SETUP UI & EVENT LISTENERS ---
  setupEventListeners() {
    // Spin button
    const spinBtn = document.getElementById('spinBtn');
    if (spinBtn) {
      spinBtn.addEventListener('click', () => this.spin());
    }

    // Keyboard shortcuts: Spacebar to spin, L or R to pick random list, Esc to close overlay
    window.addEventListener('keydown', (e) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.spin();
      } else if (e.code === 'KeyL' || e.code === 'KeyR') {
        e.preventDefault();
        this.pickRandomList();
      } else if (e.code === 'Escape') {
        this.closeRandomListOverlay();
      }
    });

    // Sound toggle
    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        sounds.toggleMute();
        this.updateAudioButtonState();
      });
    }

    // Spinner view mode switch (Wheel vs Slot)
    const modeWheelBtn = document.getElementById('modeWheelBtn');
    const modeSlotBtn = document.getElementById('modeSlotBtn');
    if (modeWheelBtn && modeSlotBtn) {
      modeWheelBtn.addEventListener('click', () => this.setSpinnerMode('wheel'));
      modeSlotBtn.addEventListener('click', () => this.setSpinnerMode('slot'));
    }

    // Runtime filter buttons
    const filterPills = document.querySelectorAll('.runtime-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        filterPills.forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.maxRuntimeFilter = e.currentTarget.dataset.filter;
        this.applyMovieFilters();
      });
    });

    // Search input within list
    const searchInput = document.getElementById('movieSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderMovieList());
    }

    // Select all / Deselect all
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        this.disabledMovieIds.clear();
        this.renderMovieList();
        this.syncSpinners();
      });
    }
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', () => {
        const cur = this.getCurrentList();
        if (cur && cur.movies) {
          cur.movies.forEach(m => this.disabledMovieIds.add(m.id));
        }
        this.renderMovieList();
        this.syncSpinners();
      });
    }

    // Custom List creation modal
    const openCustomModalBtn = document.getElementById('openCustomModalBtn');
    const customListModal = document.getElementById('customListModal');
    const closeCustomModalBtn = document.getElementById('closeCustomModalBtn');
    const saveCustomListBtn = document.getElementById('saveCustomListBtn');

    if (openCustomModalBtn && customListModal) {
      openCustomModalBtn.addEventListener('click', () => {
        customListModal.showModal();
      });
    }
    if (closeCustomModalBtn && customListModal) {
      closeCustomModalBtn.addEventListener('click', () => customListModal.close());
    }
    if (saveCustomListBtn) {
      saveCustomListBtn.addEventListener('click', () => this.handleSaveCustomList());
    }

    // History modal
    const openHistoryBtn = document.getElementById('openHistoryBtn');
    const historyModal = document.getElementById('historyModal');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    if (openHistoryBtn && historyModal) {
      openHistoryBtn.addEventListener('click', () => {
        this.renderHistoryContent();
        historyModal.showModal();
      });
    }
    if (closeHistoryBtn && historyModal) {
      closeHistoryBtn.addEventListener('click', () => historyModal.close());
    }
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        this.history = [];
        this.saveHistory();
        this.renderHistoryContent();
        this.renderHistoryBadge();
      });
    }

    // Winner Modal buttons
    const winnerModal = document.getElementById('winnerModal');
    const winnerSpinAgainBtn = document.getElementById('winnerSpinAgainBtn');
    const winnerWatchTonightBtn = document.getElementById('winnerWatchTonightBtn');
    const winnerEliminateBtn = document.getElementById('winnerEliminateBtn');
    const closeWinnerModalBtn = document.getElementById('closeWinnerModalBtn');

    if (winnerSpinAgainBtn) {
      winnerSpinAgainBtn.addEventListener('click', () => {
        winnerModal.close();
        setTimeout(() => this.spin(), 200);
      });
    }
    if (winnerWatchTonightBtn) {
      winnerWatchTonightBtn.addEventListener('click', () => {
        if (this.currentWinner) {
          this.addToHistory(this.currentWinner);
        }
        winnerModal.close();
      });
    }
    if (winnerEliminateBtn) {
      winnerEliminateBtn.addEventListener('click', () => {
        if (this.currentWinner) {
          this.disabledMovieIds.add(this.currentWinner.id);
          this.applyMovieFilters();
        }
        winnerModal.close();
        setTimeout(() => this.spin(), 200);
      });
    }
    if (closeWinnerModalBtn) {
      closeWinnerModalBtn.addEventListener('click', () => winnerModal.close());
    }

    // Random List Picker triggers
    const randomListBtn = document.getElementById('randomListBtn');
    const headerRandomListBtn = document.getElementById('headerRandomListBtn');
    const stageRandomListBtn = document.getElementById('stageRandomListBtn');

    if (randomListBtn) randomListBtn.addEventListener('click', () => this.pickRandomList());
    if (headerRandomListBtn) headerRandomListBtn.addEventListener('click', () => this.pickRandomList());
    if (stageRandomListBtn) stageRandomListBtn.addEventListener('click', () => this.pickRandomList());

    // Random list scope toggle
    const scopeAllBtn = document.getElementById('scopeAllListsBtn');
    const scopeCatBtn = document.getElementById('scopeCategoryBtn');
    if (scopeAllBtn && scopeCatBtn) {
      scopeAllBtn.addEventListener('click', () => {
        this.randomScope = 'all';
        scopeAllBtn.classList.add('active');
        scopeCatBtn.classList.remove('active');
      });
      scopeCatBtn.addEventListener('click', () => {
        this.randomScope = 'category';
        scopeCatBtn.classList.add('active');
        scopeAllBtn.classList.remove('active');
      });
    }

    // Roulette overlay controls
    const closeRouletteBtn = document.getElementById('closeRouletteBtn');
    const rouletteAcceptBtn = document.getElementById('rouletteAcceptBtn');
    const rouletteReRollBtn = document.getElementById('rouletteReRollBtn');
    const rouletteOverlay = document.getElementById('randomListOverlay');

    if (closeRouletteBtn) closeRouletteBtn.addEventListener('click', () => this.closeRandomListOverlay());
    if (rouletteAcceptBtn) rouletteAcceptBtn.addEventListener('click', () => this.closeRandomListOverlay());
    if (rouletteReRollBtn) rouletteReRollBtn.addEventListener('click', () => this.pickRandomList());
    if (rouletteOverlay) {
      rouletteOverlay.addEventListener('click', (e) => {
        if (e.target === rouletteOverlay) {
          this.closeRandomListOverlay();
        }
      });
    }
  }

  // --- RENDER CATEGORY TABS ---
  renderCategoryTabs() {
    const container = document.getElementById('categoryTabs');
    if (!container) return;

    container.innerHTML = this.categories.map(cat => `
      <button class="category-tab ${cat.id === this.currentCategoryId ? 'active' : ''}" data-category="${cat.id}">
        <span class="tab-icon">${cat.icon}</span>
        <span class="tab-name">${cat.name}</span>
      </button>
    `).join('');

    container.querySelectorAll('.category-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const catId = e.currentTarget.dataset.category;
        this.currentCategoryId = catId;
        this.renderCategoryTabs();
        this.renderListSelector();
      });
    });
  }

  // --- RENDER LIST SELECTOR PILLS ---
  renderListSelector() {
    const container = document.getElementById('listSelectorPills');
    if (!container) return;

    const availableLists = this.getAllLists().filter(l => l.categoryId === this.currentCategoryId);

    // Update list count indicator & all scope button count
    const countEl = document.getElementById('categoryListsCount');
    if (countEl) {
      const activeCat = this.categories.find(c => c.id === this.currentCategoryId);
      const catName = activeCat ? activeCat.name : '';
      countEl.textContent = `${availableLists.length} list${availableLists.length !== 1 ? 's' : ''} in ${catName}`;
    }

    const allBtn = document.getElementById('scopeAllListsBtn');
    if (allBtn) {
      allBtn.textContent = `All (${this.getAllLists().length})`;
    }

    if (availableLists.length === 0) {
      if (this.currentCategoryId === 'custom') {
        container.innerHTML = `
          <div class="empty-custom-banner">
            <span>No custom lists yet!</span>
            <button class="btn btn-secondary btn-sm" id="emptyCustomBtn">+ Create Your First Custom List</button>
          </div>
        `;
        const btn = document.getElementById('emptyCustomBtn');
        if (btn) {
          btn.addEventListener('click', () => {
            const modal = document.getElementById('customListModal');
            if (modal) modal.showModal();
          });
        }
      } else {
        container.innerHTML = `<span class="empty-text">No lists found in this category.</span>`;
      }
      return;
    }

    // Auto-select first list if current selection is not in this category
    if (!availableLists.some(l => l.id === this.currentListId)) {
      this.currentListId = availableLists[0].id;
    }

    container.innerHTML = availableLists.map(list => `
      <button class="list-pill ${list.id === this.currentListId ? 'active' : ''}" data-list-id="${list.id}">
        <span class="list-pill-icon">${list.icon || '🎬'}</span>
        <span class="list-pill-title">${list.title}</span>
        <span class="list-pill-count">${list.movies ? list.movies.length : 0}</span>
      </button>
    `).join('');

    container.querySelectorAll('.list-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        this.currentListId = e.currentTarget.dataset.listId;
        this.renderListSelector();
        this.loadActiveList();
      });
    });
  }

  // --- LOAD ACTIVE LIST ---
  loadActiveList() {
    const list = this.getCurrentList();
    if (!list) return;

    // Update active list header
    const titleEl = document.getElementById('activeListTitle');
    const taglineEl = document.getElementById('activeListTagline');
    const iconEl = document.getElementById('activeListIcon');

    if (titleEl) titleEl.textContent = list.title;
    if (taglineEl) taglineEl.textContent = list.tagline || 'Curated movie selection';
    if (iconEl) iconEl.textContent = list.icon || '🎬';

    // Reset exclusions for the new list
    this.disabledMovieIds.clear();
    this.applyMovieFilters();
  }

  // --- RANDOM LIST SELECTION & ROULETTE ---
  pickRandomList(forcedScope = null) {
    if (this.isShufflingList) return;

    sounds.init();
    const scope = forcedScope || this.randomScope;
    let pool = [];

    if (scope === 'category') {
      pool = this.getAllLists().filter(l => l.categoryId === this.currentCategoryId && l.movies && l.movies.length > 0);
      if (pool.length === 0) {
        pool = this.getAllLists().filter(l => l.movies && l.movies.length > 0);
      }
    } else {
      pool = this.getAllLists().filter(l => l.movies && l.movies.length > 0);
    }

    if (pool.length === 0) return;

    // Pick winner, prioritizing a list different from current
    const nonCurrent = pool.filter(l => l.id !== this.currentListId);
    const winner = nonCurrent.length > 0
      ? nonCurrent[Math.floor(Math.random() * nonCurrent.length)]
      : pool[0];

    this.isShufflingList = true;
    if (this.rouletteTimer) clearTimeout(this.rouletteTimer);

    // Show overlay
    const overlay = document.getElementById('randomListOverlay');
    const card = document.getElementById('randomListCard');
    const actions = document.getElementById('rouletteActions');
    const statusEl = document.getElementById('rouletteStatus');
    const iconEl = document.getElementById('rouletteIcon');
    const catEl = document.getElementById('rouletteCategory');
    const titleEl = document.getElementById('rouletteTitle');
    const countEl = document.getElementById('rouletteCount');

    if (overlay) overlay.classList.remove('hidden');
    if (actions) actions.classList.add('hidden');
    if (card) card.classList.remove('winner-landed');
    if (statusEl) statusEl.textContent = `🎲 Shuffling through ${pool.length} curated lists...`;

    // Shuffle sequence with decelerating intervals
    const delays = [45, 50, 55, 65, 80, 100, 130, 170, 220, 280, 360];
    let step = 0;

    const findCategoryName = (catId) => {
      const cat = this.categories.find(c => c.id === catId);
      return cat ? cat.name : 'Curated';
    };

    const runStep = () => {
      if (step < delays.length) {
        // Show random preview item from pool
        const randomItem = pool[Math.floor(Math.random() * pool.length)];
        if (iconEl) iconEl.textContent = randomItem.icon || '🎬';
        if (catEl) catEl.textContent = findCategoryName(randomItem.categoryId);
        if (titleEl) titleEl.textContent = randomItem.title;
        if (countEl) countEl.textContent = `${randomItem.movies ? randomItem.movies.length : 0} movies`;

        sounds.playTick(1.0 + (step / delays.length) * 0.4);

        const currentDelay = delays[step];
        step++;
        setTimeout(runStep, currentDelay);
      } else {
        // Finalize on winner!
        if (iconEl) iconEl.textContent = winner.icon || '🎬';
        if (catEl) catEl.textContent = findCategoryName(winner.categoryId);
        if (titleEl) titleEl.textContent = winner.title;
        if (countEl) countEl.textContent = `${winner.movies ? winner.movies.length : 0} movies`;

        if (statusEl) statusEl.textContent = `🎉 List Chosen for Tonight!`;
        if (card) card.classList.add('winner-landed');
        if (actions) actions.classList.remove('hidden');

        sounds.playWinnerFanfare();

        // Switch to the chosen list in the application
        this.currentCategoryId = winner.categoryId;
        this.currentListId = winner.id;
        this.renderCategoryTabs();
        this.renderListSelector();
        this.loadActiveList();

        // Highlight and scroll the chosen pill into view
        setTimeout(() => {
          const activePill = document.querySelector(`.list-pill[data-list-id="${winner.id}"]`);
          if (activePill) {
            activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            activePill.classList.add('list-pill-shuffled');
            setTimeout(() => activePill.classList.remove('list-pill-shuffled'), 2500);
          }
        }, 150);

        this.isShufflingList = false;

        // Auto-dismiss after 4 seconds of inactivity
        this.rouletteTimer = setTimeout(() => {
          this.closeRandomListOverlay();
        }, 4000);
      }
    };

    runStep();
  }

  closeRandomListOverlay() {
    if (this.rouletteTimer) clearTimeout(this.rouletteTimer);
    const overlay = document.getElementById('randomListOverlay');
    if (overlay) overlay.classList.add('hidden');
    this.isShufflingList = false;
  }

  // --- FILTER MOVIES & SYNC SPINNERS ---
  applyMovieFilters() {
    const list = this.getCurrentList();
    if (!list || !list.movies) {
      this.activeMovies = [];
      this.syncSpinners();
      this.renderMovieList();
      return;
    }

    let filtered = [...list.movies];

    // Max runtime filter
    if (this.maxRuntimeFilter === '100') {
      filtered = filtered.filter(m => (m.runtimeMinutes || 999) <= 100);
    } else if (this.maxRuntimeFilter === '120') {
      filtered = filtered.filter(m => (m.runtimeMinutes || 999) <= 120);
    }

    // Active (enabled) movies for the wheel
    this.activeMovies = filtered.filter(m => !this.disabledMovieIds.has(m.id));

    this.syncSpinners();
    this.renderMovieList();
    this.updateStats();
  }

  syncSpinners() {
    if (this.wheel) {
      this.wheel.setMovies(this.activeMovies);
    }
    if (this.slot) {
      this.slot.setMovies(this.activeMovies);
    }
  }

  // --- RENDER MOVIE LIST DRAWER / CHECKBOXES ---
  renderMovieList() {
    const container = document.getElementById('movieItemsContainer');
    const searchInput = document.getElementById('movieSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (!container) return;

    const list = this.getCurrentList();
    if (!list || !list.movies || list.movies.length === 0) {
      container.innerHTML = `<div class="empty-list-notice">No movies in this list.</div>`;
      return;
    }

    let displayList = list.movies;
    if (query) {
      displayList = displayList.filter(m =>
        m.title.toLowerCase().includes(query) ||
        (m.director && m.director.toLowerCase().includes(query)) ||
        (m.genre && m.genre.toLowerCase().includes(query))
      );
    }

    container.innerHTML = displayList.map(m => {
      const isEnabled = !this.disabledMovieIds.has(m.id);
      const isWatched = this.history.some(h => h.id === m.id);

      return `
        <div class="movie-item-row ${isEnabled ? '' : 'disabled'}">
          <label class="movie-checkbox-label">
            <input type="checkbox" class="movie-checkbox" data-id="${m.id}" ${isEnabled ? 'checked' : ''}>
            <span class="custom-check"></span>
          </label>
          <div class="movie-item-info">
            <div class="movie-item-header">
              <span class="movie-item-title">${m.title}</span>
              <span class="movie-item-year">(${m.year})</span>
              ${isWatched ? '<span class="watched-tag">Watched</span>' : ''}
            </div>
            <div class="movie-item-sub">
              <span>${m.runtime}</span>
              <span>•</span>
              <span>${m.genre}</span>
              ${m.rating ? `<span>• ⭐ ${m.rating}</span>` : ''}
            </div>
          </div>
          <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(m.title + ' ' + m.year + ' trailer')}"
             target="_blank" rel="noopener noreferrer" class="movie-trailer-link" title="Watch Trailer on YouTube">
            ▶
          </a>
        </div>
      `;
    }).join('');

    // Attach checkbox toggle events
    container.querySelectorAll('.movie-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) {
          this.disabledMovieIds.delete(id);
        } else {
          this.disabledMovieIds.add(id);
        }
        this.applyMovieFilters();
      });
    });
  }

  updateStats() {
    const countEl = document.getElementById('activeWheelCount');
    const totalEl = document.getElementById('totalListCount');
    const list = this.getCurrentList();

    if (countEl) countEl.textContent = this.activeMovies.length;
    if (totalEl && list && list.movies) totalEl.textContent = list.movies.length;

    const spinBtn = document.getElementById('spinBtn');
    if (spinBtn) {
      if (this.activeMovies.length < 2) {
        spinBtn.disabled = true;
        spinBtn.classList.add('disabled');
      } else {
        spinBtn.disabled = false;
        spinBtn.classList.remove('disabled');
      }
    }
  }

  // --- SPINNER MODE SWITCH ---
  setSpinnerMode(mode) {
    this.spinnerMode = mode;
    const wheelView = document.getElementById('wheelViewWrapper');
    const slotView = document.getElementById('slotViewWrapper');
    const modeWheelBtn = document.getElementById('modeWheelBtn');
    const modeSlotBtn = document.getElementById('modeSlotBtn');

    if (mode === 'wheel') {
      if (wheelView) wheelView.classList.remove('hidden');
      if (slotView) slotView.classList.add('hidden');
      if (modeWheelBtn) modeWheelBtn.classList.add('active');
      if (modeSlotBtn) modeSlotBtn.classList.remove('active');
      if (this.wheel) this.wheel.draw();
    } else {
      if (wheelView) wheelView.classList.add('hidden');
      if (slotView) slotView.classList.remove('hidden');
      if (modeWheelBtn) modeWheelBtn.classList.remove('active');
      if (modeSlotBtn) modeSlotBtn.classList.add('active');
      if (this.slot) this.slot.render();
    }
  }

  // --- SPIN ACTION ---
  spin() {
    if (this.activeMovies.length < 2) return;

    if (this.spinnerMode === 'wheel') {
      if (this.wheel.isSpinning) return;
      this.wheel.spin();
    } else {
      if (this.slot.isSpinning) return;
      this.slot.spin();
    }
  }

  // --- SPIN COMPLETED (WINNER CHOSEN) ---
  handleSpinComplete(winner) {
    this.currentWinner = winner;

    // Trigger celebration fanfare and confetti
    sounds.playWinnerFanfare();
    if (this.confetti) {
      this.confetti.burst(150);
    }

    // Populate Winner Modal
    const modal = document.getElementById('winnerModal');
    const titleEl = document.getElementById('winnerTitle');
    const yearEl = document.getElementById('winnerYear');
    const runtimeEl = document.getElementById('winnerRuntime');
    const genreEl = document.getElementById('winnerGenre');
    const directorEl = document.getElementById('winnerDirector');
    const taglineEl = document.getElementById('winnerTagline');
    const ratingEl = document.getElementById('winnerRating');

    if (titleEl) titleEl.textContent = winner.title;
    if (yearEl) yearEl.textContent = winner.year;
    if (runtimeEl) runtimeEl.textContent = winner.runtime;
    if (genreEl) genreEl.textContent = winner.genre;
    if (directorEl) directorEl.textContent = winner.director ? `Directed by ${winner.director}` : '';
    if (taglineEl) taglineEl.textContent = `"${winner.tagline || 'Ready for movie night!'}"`;
    if (ratingEl) ratingEl.textContent = winner.rating ? `⭐ ${winner.rating}` : '⭐ Highly Recommended';

    // Setup action links
    const justWatchLink = document.getElementById('winnerJustWatchLink');
    const trailerLink = document.getElementById('winnerTrailerLink');
    const googleLink = document.getElementById('winnerGoogleLink');

    const searchTitle = encodeURIComponent(`${winner.title} ${winner.year}`);
    if (justWatchLink) justWatchLink.href = `https://www.justwatch.com/us/search?q=${searchTitle}`;
    if (trailerLink) trailerLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(winner.title + ' ' + winner.year + ' official trailer')}`;
    if (googleLink) googleLink.href = `https://www.google.com/search?q=where+to+stream+${searchTitle}`;

    if (modal) {
      modal.showModal();
    }
  }

  // --- HISTORY MANAGEMENT ---
  addToHistory(movie) {
    const list = this.getCurrentList();
    const entry = {
      ...movie,
      watchedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      fromList: list ? list.title : 'Movie Picker'
    };

    // Avoid duplicates at top
    this.history = [entry, ...this.history.filter(h => h.id !== movie.id)];
    this.saveHistory();
    this.renderHistoryBadge();
    this.renderMovieList();
  }

  renderHistoryBadge() {
    const badge = document.getElementById('historyCountBadge');
    if (badge) {
      badge.textContent = this.history.length;
      badge.style.display = this.history.length > 0 ? 'inline-flex' : 'none';
    }
  }

  renderHistoryContent() {
    const container = document.getElementById('historyItemsContainer');
    if (!container) return;

    if (this.history.length === 0) {
      container.innerHTML = `
        <div class="empty-history-state">
          <div class="empty-history-icon">🍿</div>
          <h4>No movies watched yet!</h4>
          <p>Spin the wheel and select "Watch Tonight" to start building your couple's movie diary.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.history.map(item => `
      <div class="history-item-card">
        <div class="history-item-main">
          <div class="history-item-title">${item.title} <span class="history-item-year">(${item.year})</span></div>
          <div class="history-item-details">${item.genre} • ${item.runtime} • Dir. ${item.director || 'Unknown'}</div>
          <div class="history-item-meta">Picked from <strong>${item.fromList}</strong> on ${item.watchedAt}</div>
        </div>
        <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + ' ' + item.year + ' trailer')}"
           target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">Trailer ▶</a>
      </div>
    `).join('');
  }

  // --- CUSTOM LIST CREATOR ---
  handleSaveCustomList() {
    const nameInput = document.getElementById('customListNameInput');
    const moviesInput = document.getElementById('customListMoviesInput');
    const modal = document.getElementById('customListModal');

    const name = nameInput ? nameInput.value.trim() : '';
    const rawMovies = moviesInput ? moviesInput.value.trim() : '';

    if (!name) {
      alert('Please enter a name for your custom list!');
      return;
    }
    if (!rawMovies) {
      alert('Please enter at least two movie titles!');
      return;
    }

    // Parse lines or comma separated
    const titles = rawMovies
      .split(/[\n,]/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (titles.length < 2) {
      alert('Please add at least 2 movies to spin!');
      return;
    }

    const newList = {
      id: 'custom-' + Date.now(),
      categoryId: 'custom',
      title: name,
      icon: '📝',
      tagline: 'Custom couple list',
      movies: titles.map((title, idx) => ({
        id: `c-${Date.now()}-${idx}`,
        title: title,
        year: new Date().getFullYear(),
        runtime: 'N/A',
        runtimeMinutes: 110,
        genre: 'Custom Pick',
        director: 'Various',
        tagline: 'Added by you & your partner',
        rating: 'Custom'
      }))
    };

    this.customLists.push(newList);
    this.saveCustomLists();

    // Clear inputs and close
    if (nameInput) nameInput.value = '';
    if (moviesInput) moviesInput.value = '';
    if (modal) modal.close();

    // Switch to Custom category and select this list
    this.currentCategoryId = 'custom';
    this.currentListId = newList.id;
    this.renderCategoryTabs();
    this.renderListSelector();
    this.loadActiveList();
  }

  updateAudioButtonState() {
    const btn = document.getElementById('soundToggleBtn');
    if (!btn) return;
    if (sounds.isMuted) {
      btn.innerHTML = '🔇 <span class="btn-label">Muted</span>';
      btn.classList.add('muted');
    } else {
      btn.innerHTML = '🔊 <span class="btn-label">Sound On</span>';
      btn.classList.remove('muted');
    }
  }
}

// Launch app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MoviePickerApp();
});
