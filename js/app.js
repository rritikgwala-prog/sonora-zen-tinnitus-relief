/**
 * Sonora Zen - Main Application Controller
 * Handles UI interactions, presets, pitch matcher, somatic routines, sleep timer, & journal
 */

document.addEventListener('DOMContentLoaded', () => {
  const audio = window.tinnitusAudio;
  const visualizer = new AudioVisualizer('audioVisualizer', audio);

  // App State
  const state = {
    activeTab: 'soundscape',
    masterPlaying: false,
    timerSecondsLeft: 0,
    timerInterval: null,
    isFadingOut: false,
    tinnitusFreq: parseInt(localStorage.getItem('sonora_tinnitus_freq') || '4500'),
    notchActive: localStorage.getItem('sonora_notch_active') === 'true',
    notchQ: parseInt(localStorage.getItem('sonora_notch_q') || '15'),
    binauralActive: false,
    binauralBase: 432,
    binauralBeat: 10,
    binauralVol: 0.25,
    breathingActive: false,
    breathingTimer: null,
    somaticStep: 0,
    somaticTimer: null,
    somaticSecondsLeft: 45
  };

  // Sync stored notch settings to audio engine
  audio.setTinnitusFrequency(state.tinnitusFreq);
  audio.setNotchSharpness(state.notchQ);
  if (state.notchActive) {
    audio.setNotchActive(true);
  }

  // =========================================================================
  // DOM Elements
  // =========================================================================
  const masterPlayBtn = document.getElementById('masterPlayBtn');
  const masterPlayIcon = document.getElementById('masterPlayIcon');
  const masterPlayText = document.getElementById('masterPlayText');
  const masterVolumeSlider = document.getElementById('masterVolumeSlider');
  const masterVolumeVal = document.getElementById('masterVolumeVal');
  const visualizerModeBtn = document.getElementById('visualizerModeBtn');

  // Sleep Timer Elements
  const timerBadge = document.getElementById('timerBadge');
  const timerDisplay = document.getElementById('timerDisplay');
  const timerDropdown = document.getElementById('timerDropdown');

  // Channels
  const channelSliders = document.querySelectorAll('.channel-slider');
  const channelMuteBtns = document.querySelectorAll('.channel-mute-btn');

  // Frequency Lab Elements
  const matcherFreqSlider = document.getElementById('matcherFreqSlider');
  const matcherFreqInput = document.getElementById('matcherFreqInput');
  const matcherPanSlider = document.getElementById('matcherPanSlider');
  const matcherVolSlider = document.getElementById('matcherVolSlider');
  const matcherToggleBtn = document.getElementById('matcherToggleBtn');
  const saveTinnitusFreqBtn = document.getElementById('saveTinnitusFreqBtn');
  const notchToggleBtn = document.getElementById('notchToggleBtn');
  const notchStatusBadge = document.getElementById('notchStatusBadge');
  const currentNotchDisplay = document.getElementById('currentNotchDisplay');
  const notchQSlider = document.getElementById('notchQSlider');
  const notchQDisplay = document.getElementById('notchQDisplay');

  // Binaural Elements
  const binauralToggleBtn = document.getElementById('binauralToggleBtn');
  const binauralVolSlider = document.getElementById('binauralVolSlider');
  const binauralBaseSlider = document.getElementById('binauralBaseSlider');
  const binauralBaseVal = document.getElementById('binauralBaseVal');
  const binauralBeatVal = document.getElementById('binauralBeatVal');
  const binauralWavePills = document.querySelectorAll('.binaural-pill');

  // Somatic & Breath Elements
  const startBreathingBtn = document.getElementById('startBreathingBtn');
  const breathingHalo = document.getElementById('breathingHalo');
  const breathStateText = document.getElementById('breathStateText');
  const breathCountText = document.getElementById('breathCountText');
  const somaticStartBtn = document.getElementById('somaticStartBtn');
  const somaticTimerDisplay = document.getElementById('somaticTimerDisplay');
  const somaticCards = document.querySelectorAll('.somatic-card');

  // Journal Elements
  const tinnitusSeveritySlider = document.getElementById('tinnitusSeveritySlider');
  const tinnitusSeverityVal = document.getElementById('tinnitusSeverityVal');
  const headHeavinessSlider = document.getElementById('headHeavinessSlider');
  const headHeavinessVal = document.getElementById('headHeavinessVal');
  const triggerTags = document.querySelectorAll('.trigger-tag');
  const journalNotesInput = document.getElementById('journalNotesInput');
  const saveJournalBtn = document.getElementById('saveJournalBtn');
  const journalHistoryList = document.getElementById('journalHistoryList');

  // =========================================================================
  // Navigation Tabs
  // =========================================================================
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanels = document.querySelectorAll('.tab-panel');

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      state.activeTab = target;

      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      tabPanels.forEach(p => {
        if (p.id === `tab-${target}`) {
          p.classList.remove('hidden');
        } else {
          p.classList.add('hidden');
        }
      });
    });
  });

  // =========================================================================
  // Master Playback Control
  // =========================================================================
  const mobilePlayBtn = document.getElementById('mobilePlayBtn');
  const mobilePlayIcon = document.getElementById('mobilePlayIcon');
  const mobilePlayText = document.getElementById('mobilePlayText');
  const mobileStatusText = document.getElementById('mobileStatusText');

  // Mobile Screen WakeLock API
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {}
  }
  function releaseWakeLock() {
    if (wakeLock) {
      try { wakeLock.release(); } catch(e){}
      wakeLock = null;
    }
  }

  // Instant mobile touch unlock for AudioContext on iOS/Android
  const unlockAudioOnTouch = () => {
    if (audio && audio.ctx && audio.ctx.state === 'suspended') {
      audio.ctx.resume();
    }
    document.removeEventListener('touchstart', unlockAudioOnTouch);
    document.removeEventListener('touchend', unlockAudioOnTouch);
  };
  document.addEventListener('touchstart', unlockAudioOnTouch, { passive: true });
  document.addEventListener('touchend', unlockAudioOnTouch, { passive: true });

  async function toggleMasterPlayback() {
    if (!state.masterPlaying) {
      await audio.play();
      state.masterPlaying = true;
      requestWakeLock();
      masterPlayIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />`;
      masterPlayText.textContent = 'Pause Sanctuary';
      masterPlayBtn.classList.add('glow-cyan', 'border-cyan-400/50', 'bg-cyan-500/20');
      masterPlayBtn.classList.remove('border-white/10');

      if (mobilePlayBtn) {
        mobilePlayIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />`;
        mobilePlayText.textContent = 'Pause';
        mobilePlayBtn.classList.add('bg-rose-500/20', 'border-rose-400/40', 'text-rose-300');
        mobilePlayBtn.classList.remove('bg-cyan-500/20', 'border-cyan-400/40', 'text-cyan-300');
      }
      if (mobileStatusText) {
        mobileStatusText.textContent = 'Playing Sanctuary';
        mobileStatusText.classList.add('text-cyan-400');
        mobileStatusText.classList.remove('text-white/50');
      }
    } else {
      audio.pause();
      state.masterPlaying = false;
      releaseWakeLock();
      masterPlayIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`;
      masterPlayText.textContent = 'Resume Sanctuary';
      masterPlayBtn.classList.remove('glow-cyan', 'border-cyan-400/50', 'bg-cyan-500/20');
      masterPlayBtn.classList.add('border-white/10');

      if (mobilePlayBtn) {
        mobilePlayIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />`;
        mobilePlayText.textContent = 'Resume';
        mobilePlayBtn.classList.remove('bg-rose-500/20', 'border-rose-400/40', 'text-rose-300');
        mobilePlayBtn.classList.add('bg-cyan-500/20', 'border-cyan-400/40', 'text-cyan-300');
      }
      if (mobileStatusText) {
        mobileStatusText.textContent = 'Paused';
        mobileStatusText.classList.remove('text-cyan-400');
        mobileStatusText.classList.add('text-white/50');
      }
    }
  }

  masterPlayBtn.addEventListener('click', toggleMasterPlayback);
  if (mobilePlayBtn) {
    mobilePlayBtn.addEventListener('click', toggleMasterPlayback);
  }

  masterVolumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audio.setMasterVolume(val);
    masterVolumeVal.textContent = `${Math.round(val * 100)}%`;
  });

  // Visualizer Mode Toggle
  visualizerModeBtn.addEventListener('click', () => {
    if (visualizer.mode === 'aura') {
      visualizer.setMode('spectrum');
      visualizerModeBtn.textContent = 'Mode: Neuro Spectrum';
    } else {
      visualizer.setMode('aura');
      visualizerModeBtn.textContent = 'Mode: Zen Aura';
    }
  });

  // =========================================================================
  // Channel Mixer Sliders & Mute
  // =========================================================================
  channelSliders.forEach(slider => {
    const channelId = slider.dataset.channel;
    const valueDisplay = document.getElementById(`${channelId}Val`);

    slider.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      audio.setChannelVolume(channelId, vol);
      if (valueDisplay) {
        valueDisplay.textContent = `${Math.round(vol * 100)}%`;
      }
      // If user adjusts slider while paused, auto start smoothly
      if (!state.masterPlaying && vol > 0) {
        toggleMasterPlayback();
      }
    });
  });

  channelMuteBtns.forEach(btn => {
    const channelId = btn.dataset.channel;
    btn.addEventListener('click', () => {
      const ch = audio.channels[channelId];
      if (!ch) return;
      ch.isMuted = !ch.isMuted;
      btn.classList.toggle('text-rose-400', ch.isMuted);
      btn.classList.toggle('text-white/40', !ch.isMuted);
      if (ch.isMuted) {
        ch.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
      } else {
        ch.gain.gain.setTargetAtTime(ch.targetVolume, audio.ctx.currentTime, 0.05);
      }
    });
  });

  // =========================================================================
  // Presets
  // =========================================================================
  const presets = {
    heavyHeadRelief: {
      brown: 0.85,
      pink: 0.2,
      white: 0.0,
      rain: 0.45,
      ocean: 0.5,
      fan: 0.35,
      crickets: 0.0,
      binaural: true,
      binauralBeat: 10 // Alpha wave
    },
    deepSleep: {
      brown: 0.7,
      pink: 0.1,
      white: 0.0,
      rain: 0.6,
      ocean: 0.4,
      fan: 0.25,
      crickets: 0.15,
      binaural: true,
      binauralBeat: 4 // Theta/Delta
    },
    crispMask: {
      brown: 0.3,
      pink: 0.7,
      white: 0.45,
      rain: 0.3,
      ocean: 0.0,
      fan: 0.0,
      crickets: 0.0,
      binaural: false
    },
    pureNature: {
      brown: 0.2,
      pink: 0.3,
      white: 0.0,
      rain: 0.75,
      ocean: 0.6,
      fan: 0.0,
      crickets: 0.3,
      binaural: false
    }
  };

  function applyPreset(name) {
    const p = presets[name];
    if (!p) return;

    ['brown', 'pink', 'white', 'rain', 'ocean', 'fan', 'crickets'].forEach(chId => {
      const vol = p[chId] || 0;
      audio.setChannelVolume(chId, vol);
      const slider = document.querySelector(`.channel-slider[data-channel="${chId}"]`);
      const valDisp = document.getElementById(`${chId}Val`);
      if (slider) slider.value = vol;
      if (valDisp) valDisp.textContent = `${Math.round(vol * 100)}%`;
    });

    if (p.binaural) {
      state.binauralBeat = p.binauralBeat;
      selectBinauralPreset(state.binauralBeat);
      if (!state.binauralActive) {
        toggleBinaural(true);
      }
    }

    if (!state.masterPlaying) {
      toggleMasterPlayback();
    }
  }

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('border-cyan-400', 'bg-cyan-500/10'));
      btn.classList.add('border-cyan-400', 'bg-cyan-500/10');
      applyPreset(btn.dataset.preset);
    });
  });

  // =========================================================================
  // Sleep Timer with Soft Exponential Fade-Out
  // =========================================================================
  function setSleepTimer(minutes) {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    state.isFadingOut = false;

    if (minutes <= 0) {
      state.timerSecondsLeft = 0;
      timerBadge.textContent = 'Sleep Timer';
      timerDisplay.classList.add('hidden');
      return;
    }

    state.timerSecondsLeft = minutes * 60;
    timerDisplay.classList.remove('hidden');
    updateTimerDisplay();

    state.timerInterval = setInterval(() => {
      state.timerSecondsLeft--;

      // Initiate soft 90s fade-out in final moments
      if (state.timerSecondsLeft <= 90 && !state.isFadingOut && state.masterPlaying) {
        state.isFadingOut = true;
        audio.fadeMasterOut(90, () => {
          state.masterPlaying = false;
          masterPlayText.textContent = 'Resume Sanctuary';
        });
      }

      if (state.timerSecondsLeft <= 0) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        timerBadge.textContent = 'Sleep Timer';
        timerDisplay.classList.add('hidden');
        audio.pause();
        state.masterPlaying = false;
      } else {
        updateTimerDisplay();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const m = Math.floor(state.timerSecondsLeft / 60);
    const s = state.timerSecondsLeft % 60;
    timerBadge.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  document.querySelectorAll('.timer-opt').forEach(opt => {
    opt.addEventListener('click', (e) => {
      const min = parseInt(e.currentTarget.dataset.minutes);
      setSleepTimer(min);
      timerDropdown.classList.add('hidden');
    });
  });

  const timerBtn = document.getElementById('timerBtn');
  timerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    timerDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    if (timerDropdown) timerDropdown.classList.add('hidden');
  });

  // =========================================================================
  // Frequency Lab (Tinnitus Pitch Matcher & Notch Therapy)
  // =========================================================================
  matcherFreqSlider.value = state.tinnitusFreq;
  matcherFreqInput.value = state.tinnitusFreq;
  currentNotchDisplay.textContent = `${state.tinnitusFreq} Hz`;

  function updateMatcherFrequency(val) {
    const freq = Math.max(200, Math.min(16000, parseInt(val)));
    state.tinnitusFreq = freq;
    matcherFreqSlider.value = freq;
    matcherFreqInput.value = freq;

    if (audio.isMatcherActive) {
      audio.updateMatcherFreq(freq);
    }
  }

  matcherFreqSlider.addEventListener('input', (e) => updateMatcherFrequency(e.target.value));
  matcherFreqInput.addEventListener('change', (e) => updateMatcherFrequency(e.target.value));

  // Step Adjustment Buttons
  document.querySelectorAll('.freq-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.dataset.step);
      updateMatcherFrequency(state.tinnitusFreq + step);
    });
  });

  // Ear Balance Pan
  matcherPanSlider.addEventListener('input', (e) => {
    const pan = parseFloat(e.target.value);
    audio.updateMatcherPan(pan);
    const panText = document.getElementById('matcherPanVal');
    if (pan === 0) panText.textContent = 'Center';
    else if (pan < 0) panText.textContent = `Left ${Math.round(Math.abs(pan) * 100)}%`;
    else panText.textContent = `Right ${Math.round(pan * 100)}%`;
  });

  // Matcher Tone Volume
  matcherVolSlider.addEventListener('input', (e) => {
    const vol = parseFloat(e.target.value);
    audio.updateMatcherVolume(vol);
  });

  // Toggle Pitch Matcher Tone
  matcherToggleBtn.addEventListener('click', () => {
    if (!audio.isMatcherActive) {
      audio.startPitchMatcher(state.tinnitusFreq, parseFloat(matcherPanSlider.value), parseFloat(matcherVolSlider.value));
      matcherToggleBtn.textContent = 'Stop Tone Generator';
      matcherToggleBtn.classList.replace('bg-indigo-600', 'bg-rose-600');
    } else {
      audio.stopPitchMatcher();
      matcherToggleBtn.textContent = 'Listen & Match Frequency';
      matcherToggleBtn.classList.replace('bg-rose-600', 'bg-indigo-600');
    }
  });

  // Save Tinnitus Frequency
  saveTinnitusFreqBtn.addEventListener('click', () => {
    audio.setTinnitusFrequency(state.tinnitusFreq);
    localStorage.setItem('sonora_tinnitus_freq', state.tinnitusFreq);
    currentNotchDisplay.textContent = `${state.tinnitusFreq} Hz`;

    // Toast feedback
    saveTinnitusFreqBtn.textContent = '✓ Saved to Notch Filter';
    saveTinnitusFreqBtn.classList.add('bg-emerald-600');
    setTimeout(() => {
      saveTinnitusFreqBtn.textContent = 'Lock as My Tinnitus Frequency';
      saveTinnitusFreqBtn.classList.remove('bg-emerald-600');
    }, 2000);
  });

  // Notch Filter Activation
  function updateNotchUI() {
    if (state.notchActive) {
      notchStatusBadge.textContent = 'ACTIVE';
      notchStatusBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30';
      notchToggleBtn.textContent = 'Disable Notch Therapy';
      notchToggleBtn.classList.add('glow-rose', 'border-rose-500/50', 'bg-rose-500/10');
    } else {
      notchStatusBadge.textContent = 'DISABLED';
      notchStatusBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/50 border border-white/10';
      notchToggleBtn.textContent = 'Enable Notch Therapy';
      notchToggleBtn.classList.remove('glow-rose', 'border-rose-500/50', 'bg-rose-500/10');
    }
  }

  notchToggleBtn.addEventListener('click', () => {
    state.notchActive = !state.notchActive;
    localStorage.setItem('sonora_notch_active', state.notchActive);
    audio.setNotchActive(state.notchActive);
    updateNotchUI();
  });
  updateNotchUI();

  // Notch Sharpness (Q)
  notchQSlider.value = state.notchQ;
  notchQDisplay.textContent = `Q = ${state.notchQ}`;
  notchQSlider.addEventListener('input', (e) => {
    const q = parseInt(e.target.value);
    state.notchQ = q;
    localStorage.setItem('sonora_notch_q', q);
    audio.setNotchSharpness(q);
    notchQDisplay.textContent = `Q = ${q} (${q > 20 ? 'Ultra Precise' : q > 10 ? 'Standard' : 'Broad'})`;
  });

  // =========================================================================
  // Brainwave & Binaural Beats Engine
  // =========================================================================
  function selectBinauralPreset(beatHz) {
    state.binauralBeat = beatHz;
    binauralBeatVal.textContent = `${beatHz} Hz`;

    binauralWavePills.forEach(pill => {
      const hz = parseFloat(pill.dataset.hz);
      if (hz === beatHz) {
        pill.classList.add('border-indigo-400', 'bg-indigo-500/20', 'text-white');
      } else {
        pill.classList.remove('border-indigo-400', 'bg-indigo-500/20', 'text-white');
      }
    });

    if (state.binauralActive) {
      audio.updateBinauralSettings(state.binauralBase, state.binauralBeat, state.binauralVol);
    }
  }

  binauralWavePills.forEach(pill => {
    pill.addEventListener('click', () => {
      selectBinauralPreset(parseFloat(pill.dataset.hz));
    });
  });

  binauralBaseSlider.addEventListener('input', (e) => {
    const base = parseInt(e.target.value);
    state.binauralBase = base;
    binauralBaseVal.textContent = `${base} Hz`;
    if (state.binauralActive) {
      audio.updateBinauralSettings(state.binauralBase, state.binauralBeat, state.binauralVol);
    }
  });

  binauralVolSlider.addEventListener('input', (e) => {
    const vol = parseFloat(e.target.value);
    state.binauralVol = vol;
    document.getElementById('binauralVolVal').textContent = `${Math.round(vol * 100)}%`;
    if (state.binauralActive) {
      audio.updateBinauralSettings(state.binauralBase, state.binauralBeat, state.binauralVol);
    }
  });

  function toggleBinaural(forceState = null) {
    state.binauralActive = forceState !== null ? forceState : !state.binauralActive;

    if (state.binauralActive) {
      audio.startBinauralBeats(state.binauralBase, state.binauralBeat, state.binauralVol);
      binauralToggleBtn.textContent = 'Disable Binaural Beats';
      binauralToggleBtn.classList.add('bg-indigo-600', 'glow-indigo');
      if (!state.masterPlaying) toggleMasterPlayback();
    } else {
      audio.stopBinauralBeats();
      binauralToggleBtn.textContent = 'Enable Binaural Beats';
      binauralToggleBtn.classList.remove('bg-indigo-600', 'glow-indigo');
    }
  }

  binauralToggleBtn.addEventListener('click', () => toggleBinaural());

  // =========================================================================
  // Somatic & 4-7-8 Breathing Guide (Relief for Heavy Head)
  // =========================================================================
  function runBreathingCycle() {
    let phase = 'inhale';
    let counter = 4;
    breathStateText.textContent = 'Inhale deeply through nose...';
    breathCountText.textContent = counter;
    breathingHalo.className = 'breathing-halo inhale w-44 h-44 rounded-full border-2 border-cyan-400 flex items-center justify-center';

    state.breathingTimer = setInterval(() => {
      counter--;
      breathCountText.textContent = counter;

      if (counter <= 0) {
        if (phase === 'inhale') {
          phase = 'hold';
          counter = 7;
          breathStateText.textContent = 'Hold breath & relax jaw...';
          breathingHalo.className = 'breathing-halo hold w-44 h-44 rounded-full border-2 border-purple-400 flex items-center justify-center';
        } else if (phase === 'hold') {
          phase = 'exhale';
          counter = 8;
          breathStateText.textContent = 'Exhale slowly through mouth...';
          breathingHalo.className = 'breathing-halo exhale w-44 h-44 rounded-full border-2 border-emerald-400 flex items-center justify-center';
        } else {
          phase = 'inhale';
          counter = 4;
          breathStateText.textContent = 'Inhale deeply through nose...';
          breathingHalo.className = 'breathing-halo inhale w-44 h-44 rounded-full border-2 border-cyan-400 flex items-center justify-center';
        }
      }
    }, 1000);
  }

  startBreathingBtn.addEventListener('click', () => {
    state.breathingActive = !state.breathingActive;
    if (state.breathingActive) {
      startBreathingBtn.textContent = 'Stop Breathing Guide';
      startBreathingBtn.classList.replace('bg-cyan-600', 'bg-rose-600');
      runBreathingCycle();
    } else {
      clearInterval(state.breathingTimer);
      startBreathingBtn.textContent = 'Start 4-7-8 Breathing Routine';
      startBreathingBtn.classList.replace('bg-rose-600', 'bg-cyan-600');
      breathStateText.textContent = 'Ready to begin';
      breathCountText.textContent = '4-7-8';
      breathingHalo.className = 'breathing-halo w-44 h-44 rounded-full border-2 border-white/20 flex items-center justify-center';
    }
  });

  // Somatic Step-by-Step Routine
  function startSomaticRoutine() {
    state.somaticStep = 0;
    state.somaticSecondsLeft = 45;
    somaticStartBtn.textContent = 'Next Exercise';
    updateSomaticCardDisplay();

    if (state.somaticTimer) clearInterval(state.somaticTimer);
    state.somaticTimer = setInterval(() => {
      state.somaticSecondsLeft--;
      somaticTimerDisplay.textContent = `${state.somaticSecondsLeft}s`;

      if (state.somaticSecondsLeft <= 0) {
        state.somaticStep++;
        if (state.somaticStep >= somaticCards.length) {
          clearInterval(state.somaticTimer);
          somaticTimerDisplay.textContent = 'Completed!';
          somaticStartBtn.textContent = 'Restart Somatic Routine';
          state.somaticStep = 0;
        } else {
          state.somaticSecondsLeft = 45;
          updateSomaticCardDisplay();
        }
      }
    }, 1000);
  }

  function updateSomaticCardDisplay() {
    somaticCards.forEach((card, idx) => {
      if (idx === state.somaticStep) {
        card.classList.add('border-cyan-400', 'bg-cyan-500/10');
        card.classList.remove('opacity-40');
      } else {
        card.classList.remove('border-cyan-400', 'bg-cyan-500/10');
        card.classList.add('opacity-40');
      }
    });
  }

  somaticStartBtn.addEventListener('click', () => {
    if (!state.somaticTimer || state.somaticStep === 0) {
      startSomaticRoutine();
    } else {
      state.somaticStep++;
      if (state.somaticStep >= somaticCards.length) {
        state.somaticStep = 0;
      }
      state.somaticSecondsLeft = 45;
      updateSomaticCardDisplay();
    }
  });

  // =========================================================================
  // Daily Tinnitus & Head Heaviness Journal
  // =========================================================================
  tinnitusSeveritySlider.addEventListener('input', (e) => {
    tinnitusSeverityVal.textContent = `${e.target.value}/10`;
  });

  headHeavinessSlider.addEventListener('input', (e) => {
    headHeavinessVal.textContent = `${e.target.value}/10`;
  });

  triggerTags.forEach(tag => {
    tag.addEventListener('click', () => {
      tag.classList.toggle('active');
      tag.classList.toggle('bg-cyan-500/20');
      tag.classList.toggle('border-cyan-400');
      tag.classList.toggle('text-white');
    });
  });

  function loadJournalEntries() {
    const entries = JSON.parse(localStorage.getItem('sonora_journal') || '[]');
    journalHistoryList.innerHTML = '';

    if (entries.length === 0) {
      journalHistoryList.innerHTML = `<div class="text-sm text-white/40 italic p-4 text-center">No entries yet. Log today's condition above to track your relief progress!</div>`;
      return;
    }

    entries.slice(-5).reverse().forEach(entry => {
      const item = document.createElement('div');
      item.className = 'glass-card p-3 rounded-xl border border-white/5 space-y-1';
      item.innerHTML = `
        <div class="flex items-center justify-between text-xs text-white/50">
          <span>${entry.date}</span>
          <span class="flex gap-2">
            <span class="text-rose-400 font-semibold">Tinnitus: ${entry.tinnitus}/10</span>
            <span class="text-cyan-400 font-semibold">Heaviness: ${entry.heaviness}/10</span>
          </span>
        </div>
        ${entry.triggers.length > 0 ? `<div class="flex flex-wrap gap-1 mt-1">${entry.triggers.map(t => `<span class="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/70">${t}</span>`).join('')}</div>` : ''}
        ${entry.notes ? `<div class="text-xs text-white/80 mt-1 italic">"${entry.notes}"</div>` : ''}
      `;
      journalHistoryList.appendChild(item);
    });
  }

  saveJournalBtn.addEventListener('click', () => {
    const selectedTriggers = [];
    document.querySelectorAll('.trigger-tag.active').forEach(tag => {
      selectedTriggers.push(tag.textContent.trim());
    });

    const newEntry = {
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      tinnitus: tinnitusSeveritySlider.value,
      heaviness: headHeavinessSlider.value,
      triggers: selectedTriggers,
      notes: journalNotesInput.value.trim()
    };

    const entries = JSON.parse(localStorage.getItem('sonora_journal') || '[]');
    entries.push(newEntry);
    localStorage.setItem('sonora_journal', JSON.stringify(entries));

    journalNotesInput.value = '';
    saveJournalBtn.textContent = '✓ Entry Logged';
    saveJournalBtn.classList.add('bg-emerald-600');
    setTimeout(() => {
      saveJournalBtn.textContent = 'Log Daily Progress';
      saveJournalBtn.classList.remove('bg-emerald-600');
    }, 2000);

    loadJournalEntries();
  });

  loadJournalEntries();

  // =========================================================================
  // PWA & Install Modal Handling
  // =========================================================================
  let deferredPrompt = null;
  const installModal = document.getElementById('installModal');
  const installAppBtn = document.getElementById('installAppBtn');
  const closeInstallModalBtn = document.getElementById('closeInstallModalBtn');
  const dismissInstallModalBtn = document.getElementById('dismissInstallModalBtn');
  const pwaPromptContainer = document.getElementById('pwaPromptContainer');
  const pwaInstallTrigger = document.getElementById('pwaInstallTrigger');

  // Register Service Worker for 100% offline support
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch((err) => {
        console.log('ServiceWorker notice:', err);
      });
    });
  }

  // Capture PWA install event on Android / Chrome
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaPromptContainer) {
      pwaPromptContainer.classList.remove('hidden');
    }
  });

  if (pwaInstallTrigger) {
    pwaInstallTrigger.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          deferredPrompt = null;
          if (installModal) installModal.classList.add('hidden');
        }
      }
    });
  }

  if (installAppBtn) {
    installAppBtn.addEventListener('click', () => {
      if (installModal) installModal.classList.remove('hidden');
    });
  }

  if (closeInstallModalBtn) {
    closeInstallModalBtn.addEventListener('click', () => {
      if (installModal) installModal.classList.add('hidden');
    });
  }

  if (dismissInstallModalBtn) {
    dismissInstallModalBtn.addEventListener('click', () => {
      if (installModal) installModal.classList.add('hidden');
    });
  }

  if (installModal) {
    installModal.addEventListener('click', (e) => {
      if (e.target === installModal) {
        installModal.classList.add('hidden');
      }
    });
  }
});
