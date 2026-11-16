/**
 * Sonora Zen - Advanced Biomimetic & Neuro-acoustic Sound Engine
 * Designed for Tinnitus Masking, Notch Therapy, and Somatic Relief
 * Pure Web Audio API - Zero external dependencies, 100% offline & instantaneous
 */

class TinnitusAudioEngine {
  constructor() {
    this.ctx = null;
    this.isInitialized = false;
    this.isPlaying = false;
    
    // Master Nodes
    this.masterGain = null;
    this.compressor = null; // Protection limiter for sensitive ears
    this.analyser = null;
    this.notchFilter = null;
    this.isNotchActive = false;
    this.tinnitusFrequency = 4500; // Default test frequency in Hz
    this.notchQ = 15; // Notch sharpness
    
    // Channels registry: { id: { gainNode, sourceNode, panNode, volume, isMuted } }
    this.channels = {};
    
    // Pitch Matcher (Tone Generator)
    this.matcherOsc = null;
    this.matcherGain = null;
    this.matcherPanner = null;
    this.isMatcherActive = false;
    this.matcherFreq = 4500;
    
    // Binaural Beat Engine
    this.binauralLeftOsc = null;
    this.binauralRightOsc = null;
    this.binauralGain = null;
    this.isBinauralActive = false;
    this.binauralBaseFreq = 432; // Healing tone base
    this.binauralBeatFreq = 10;  // Alpha wave default
    
    // Modulation LFOs (for ocean, rain dynamics)
    this.lfos = [];

    // Master volume (0 to 1)
    this.masterVolumeLevel = 0.75;
  }

  /**
   * Initializes AudioContext upon first user gesture
   */
  async init() {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext({ latencyHint: 'interactive' });

    // 1. Analyser Node for 60FPS Visualizer
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.85;

    // 2. Protective Compressor / Limiter (Safety check to never blow ear sensitivity)
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

    // 3. Master Notch Filter Node (for Neuro-acoustic Notch Therapy)
    this.notchFilter = this.ctx.createBiquadFilter();
    this.notchFilter.type = 'notch';
    this.notchFilter.frequency.setValueAtTime(this.tinnitusFrequency, this.ctx.currentTime);
    this.notchFilter.Q.setValueAtTime(this.notchQ, this.ctx.currentTime);

    // 4. Master Gain Node
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolumeLevel, this.ctx.currentTime);

    // Connection Chain:
    // [Sources] -> [notchFilter or Direct] -> masterGain -> compressor -> analyser -> destination
    this.updateNotchRouting();

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Build the synthesized ambient sound generators
    this.createAmbientGenerators();

    this.isInitialized = true;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Routing switch for Notch Therapy
   */
  updateNotchRouting() {
    if (!this.ctx) return;
    this.notchFilter.frequency.setTargetAtTime(this.tinnitusFrequency, this.ctx.currentTime, 0.05);
    this.notchFilter.Q.setTargetAtTime(this.notchQ, this.ctx.currentTime, 0.05);
  }

  /**
   * Connect an individual channel output into the master audio chain
   */
  routeToMaster(node) {
    if (this.isNotchActive) {
      node.connect(this.notchFilter);
      try {
        this.notchFilter.connect(this.masterGain);
      } catch (e) {
        // already connected
      }
    } else {
      try {
        node.disconnect(this.notchFilter);
      } catch (e) {}
      node.connect(this.masterGain);
    }
  }

  /**
   * Toggle Notch Filter therapy on or off across ambient sounds
   */
  setNotchActive(active) {
    this.isNotchActive = active;
    if (!this.isInitialized) return;

    // Reroute active channels
    Object.keys(this.channels).forEach(id => {
      const ch = this.channels[id];
      if (ch && ch.outputNode) {
        ch.outputNode.disconnect();
        if (this.isNotchActive) {
          ch.outputNode.connect(this.notchFilter);
          try { this.notchFilter.connect(this.masterGain); } catch(e){}
        } else {
          ch.outputNode.connect(this.masterGain);
        }
      }
    });
  }

  setTinnitusFrequency(freq) {
    this.tinnitusFrequency = Math.max(200, Math.min(18000, freq));
    if (this.notchFilter && this.ctx) {
      this.notchFilter.frequency.setTargetAtTime(this.tinnitusFrequency, this.ctx.currentTime, 0.05);
    }
  }

  setNotchSharpness(q) {
    this.notchQ = Math.max(1, Math.min(40, q));
    if (this.notchFilter && this.ctx) {
      this.notchFilter.Q.setTargetAtTime(this.notchQ, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Pre-generates seamless looping audio buffers for different noises
   */
  createNoiseBuffer(type, seconds = 5) {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * seconds;
    const buffer = this.ctx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    if (type === 'brown') {
      // Brownian / Red Noise: integrated white noise (deep, comforting rumble)
      for (let ch = 0; ch < 2; ch++) {
        const data = ch === 0 ? left : right;
        let lastOut = 0.0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + (0.02 * white)) / 1.02;
          data[i] = lastOut * 3.5; // Gain boost
        }
      }
    } else if (type === 'pink') {
      // Pink Noise: 1/f spectrum using Paul Kellet's refined 6-stage filter
      for (let ch = 0; ch < 2; ch++) {
        const data = ch === 0 ? left : right;
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      }
    } else if (type === 'white') {
      // Pure White Noise
      for (let ch = 0; ch < 2; ch++) {
        const data = ch === 0 ? left : right;
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.25;
        }
      }
    }

    return buffer;
  }

  /**
   * Synthesizes all procedural ambient audio tracks
   */
  createAmbientGenerators() {
    const brownBuffer = this.createNoiseBuffer('brown', 6);
    const pinkBuffer = this.createNoiseBuffer('pink', 6);
    const whiteBuffer = this.createNoiseBuffer('white', 6);

    // 1. Velvet Brown Noise (Head-heaviness & Deep mask)
    this.setupNoiseChannel('brown', brownBuffer, { filterType: 'lowpass', filterFreq: 650, defaultVol: 0.6 });

    // 2. Calming Pink Noise (Auditory cortex relaxation)
    this.setupNoiseChannel('pink', pinkBuffer, { filterType: 'lowpass', filterFreq: 3200, defaultVol: 0.0 });

    // 3. Crisp White Noise (Direct High-pitch masking)
    this.setupNoiseChannel('white', whiteBuffer, { filterType: 'highpass', filterFreq: 2800, defaultVol: 0.0 });

    // 4. Synthesized Rain (Multilayer organic raindrops & soothing downpour)
    this.setupRainChannel(pinkBuffer);

    // 5. Ocean Surf (Wave swell with slow resonant LFO)
    this.setupOceanChannel(pinkBuffer);

    // 6. Deep Fan / Air Purifier Hum (Subtle motor drone + steady airflow)
    this.setupFanChannel(brownBuffer);

    // 7. Night Forest / Serene Crickets (High ethereal nighttime vibe)
    this.setupCricketsChannel();
  }

  /**
   * Helper to initialize a noise channel with filter and gain
   */
  setupNoiseChannel(id, buffer, opts = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);

    let outputNode = gainNode;

    if (opts.filterType) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = opts.filterType;
      filter.frequency.setValueAtTime(opts.filterFreq || 1000, this.ctx.currentTime);
      src.connect(filter);
      filter.connect(gainNode);
    } else {
      src.connect(gainNode);
    }

    // Connect into Master Chain
    this.routeToMaster(gainNode);
    src.start();

    this.channels[id] = {
      source: src,
      gain: gainNode,
      outputNode: gainNode,
      targetVolume: opts.defaultVol || 0,
      currentVolume: 0,
      isMuted: false
    };
  }

  /**
   * Realistic Rain Synthesis: Filtered Pink Noise + subtle high shimmer
   */
  setupRainChannel(pinkBuffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = pinkBuffer;
    src.loop = true;

    // Bandpass for body of rain
    const bpFilter = this.ctx.createBiquadFilter();
    bpFilter.type = 'bandpass';
    bpFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    bpFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

    // Highpass for rain sizzle
    const hpFilter = this.ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.setValueAtTime(4200, this.ctx.currentTime);

    const rainGain = this.ctx.createGain();
    rainGain.gain.setValueAtTime(0, this.ctx.currentTime);

    src.connect(bpFilter);
    bpFilter.connect(rainGain);

    src.connect(hpFilter);
    hpFilter.connect(rainGain);

    this.routeToMaster(rainGain);
    src.start();

    this.channels['rain'] = {
      source: src,
      gain: rainGain,
      outputNode: rainGain,
      targetVolume: 0.0,
      currentVolume: 0,
      isMuted: false
    };
  }

  /**
   * Ocean Surf Synthesis: Modulated lowpass filter creating continuous tidal swells
   */
  setupOceanChannel(pinkBuffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = pinkBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    // LFO to simulate wave swell every 9 seconds
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.11, this.ctx.currentTime); // ~9 sec period

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(450, this.ctx.currentTime); // Sweeps 400 +/- 450 Hz

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.lfos.push(lfo);

    const oceanGain = this.ctx.createGain();
    oceanGain.gain.setValueAtTime(0, this.ctx.currentTime);

    src.connect(filter);
    filter.connect(oceanGain);

    this.routeToMaster(oceanGain);
    src.start();

    this.channels['ocean'] = {
      source: src,
      gain: oceanGain,
      outputNode: oceanGain,
      targetVolume: 0.0,
      currentVolume: 0,
      isMuted: false
    };
  }

  /**
   * Fan / Airflow generator: Low rumbling resonance + gentle breeze
   */
  setupFanChannel(brownBuffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = brownBuffer;
    src.loop = true;

    const filter1 = this.ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(320, this.ctx.currentTime);

    // Subtle 120Hz mechanical resonance
    const humOsc = this.ctx.createOscillator();
    humOsc.type = 'sine';
    humOsc.frequency.setValueAtTime(118, this.ctx.currentTime);
    const humGain = this.ctx.createGain();
    humGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    humOsc.connect(humGain);
    humOsc.start();

    const fanGain = this.ctx.createGain();
    fanGain.gain.setValueAtTime(0, this.ctx.currentTime);

    src.connect(filter1);
    filter1.connect(fanGain);
    humGain.connect(fanGain);

    this.routeToMaster(fanGain);
    src.start();

    this.channels['fan'] = {
      source: src,
      gain: fanGain,
      outputNode: fanGain,
      targetVolume: 0.0,
      currentVolume: 0,
      isMuted: false
    };
  }

  /**
   * Serene Night Crickets: Pulsed high harmonic cluster
   */
  setupCricketsChannel() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(4800, this.ctx.currentTime);

    // Tremolo LFO
    const tremolo = this.ctx.createOscillator();
    tremolo.type = 'square';
    tremolo.frequency.setValueAtTime(14, this.ctx.currentTime); // 14 Hz cricket chirp rate

    const tremoloGain = this.ctx.createGain();
    tremoloGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    const cricketsGain = this.ctx.createGain();
    cricketsGain.gain.setValueAtTime(0, this.ctx.currentTime);

    osc.connect(cricketsGain);
    osc.start();
    tremolo.start();

    this.routeToMaster(cricketsGain);

    this.channels['crickets'] = {
      source: osc,
      gain: cricketsGain,
      outputNode: cricketsGain,
      targetVolume: 0.0,
      currentVolume: 0,
      isMuted: false
    };
  }

  /**
   * Adjust channel volume smoothly without clicks
   */
  setChannelVolume(channelId, volume) {
    const ch = this.channels[channelId];
    if (!ch) return;
    ch.targetVolume = Math.max(0, Math.min(1, volume));
    if (this.isPlaying && !ch.isMuted && this.ctx) {
      ch.gain.gain.setTargetAtTime(ch.targetVolume, this.ctx.currentTime, 0.08);
      ch.currentVolume = ch.targetVolume;
    }
  }

  /**
   * Start Master Playback
   */
  async play() {
    await this.init();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.isPlaying = true;

    // Fade in all active channels to their target volume
    const now = this.ctx.currentTime;
    Object.keys(this.channels).forEach(id => {
      const ch = this.channels[id];
      if (ch && !ch.isMuted) {
        ch.gain.gain.setTargetAtTime(ch.targetVolume, now, 0.12);
        ch.currentVolume = ch.targetVolume;
      }
    });

    if (this.isBinauralActive) {
      this.startBinauralBeats();
    }
  }

  /**
   * Pause Master Playback with gentle soft fade-out (prevents sudden silence rebound)
   */
  pause() {
    if (!this.isInitialized || !this.isPlaying) return;
    const now = this.ctx.currentTime;

    Object.keys(this.channels).forEach(id => {
      const ch = this.channels[id];
      if (ch) {
        ch.gain.gain.setTargetAtTime(0, now, 0.1);
      }
    });

    if (this.binauralGain) {
      this.binauralGain.gain.setTargetAtTime(0, now, 0.1);
    }

    this.isPlaying = false;
  }

  setMasterVolume(val) {
    this.masterVolumeLevel = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolumeLevel, this.ctx.currentTime, 0.05);
    }
  }

  // =========================================================================
  // PITCH MATCHER (TINNITUS TONE DETECTOR & GENERATOR)
  // =========================================================================

  startPitchMatcher(frequency, earBalance = 0, volume = 0.2) {
    this.init();
    this.stopPitchMatcher();

    this.matcherFreq = frequency;
    this.matcherOsc = this.ctx.createOscillator();
    this.matcherOsc.type = 'sine';
    this.matcherOsc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    this.matcherGain = this.ctx.createGain();
    this.matcherGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.matcherGain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), this.ctx.currentTime + 0.1);

    // Stereo Panning (-1 = Left, 0 = Center, +1 = Right)
    if (this.ctx.createStereoPanner) {
      this.matcherPanner = this.ctx.createStereoPanner();
      this.matcherPanner.pan.setValueAtTime(earBalance, this.ctx.currentTime);
      this.matcherOsc.connect(this.matcherGain);
      this.matcherGain.connect(this.matcherPanner);
      this.matcherPanner.connect(this.masterGain);
    } else {
      this.matcherOsc.connect(this.matcherGain);
      this.matcherGain.connect(this.masterGain);
    }

    this.matcherOsc.start();
    this.isMatcherActive = true;
  }

  updateMatcherFreq(freq) {
    this.matcherFreq = freq;
    if (this.matcherOsc && this.ctx) {
      this.matcherOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.03);
    }
  }

  updateMatcherPan(panVal) {
    if (this.matcherPanner && this.ctx) {
      this.matcherPanner.pan.setTargetAtTime(panVal, this.ctx.currentTime, 0.05);
    }
  }

  updateMatcherVolume(vol) {
    if (this.matcherGain && this.ctx) {
      this.matcherGain.gain.setTargetAtTime(Math.max(0.0001, vol), this.ctx.currentTime, 0.05);
    }
  }

  stopPitchMatcher() {
    if (this.matcherOsc) {
      try {
        const now = this.ctx.currentTime;
        this.matcherGain.gain.setTargetAtTime(0, now, 0.05);
        setTimeout(() => {
          if (this.matcherOsc) {
            this.matcherOsc.stop();
            this.matcherOsc.disconnect();
            this.matcherOsc = null;
          }
        }, 80);
      } catch (e) {}
    }
    this.isMatcherActive = false;
  }

  // =========================================================================
  // BINAURAL BEATS ENGINE (Brainwave Entrainment)
  // Requires Stereo output / headphones
  // =========================================================================

  startBinauralBeats(baseFreq = 432, beatFreq = 10, volume = 0.25) {
    this.init();
    this.stopBinauralBeats();

    this.binauralBaseFreq = baseFreq;
    this.binauralBeatFreq = beatFreq;

    const merger = this.ctx.createChannelMerger(2);

    // Left Ear Oscillator
    this.binauralLeftOsc = this.ctx.createOscillator();
    this.binauralLeftOsc.type = 'sine';
    this.binauralLeftOsc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

    // Right Ear Oscillator (Shifted by exact beat frequency)
    this.binauralRightOsc = this.ctx.createOscillator();
    this.binauralRightOsc.type = 'sine';
    this.binauralRightOsc.frequency.setValueAtTime(baseFreq + beatFreq, this.ctx.currentTime);

    this.binauralGain = this.ctx.createGain();
    this.binauralGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.binauralGain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), this.ctx.currentTime + 0.15);

    // Connect to merger channels: 0 = Left, 1 = Right
    this.binauralLeftOsc.connect(merger, 0, 0);
    this.binauralRightOsc.connect(merger, 0, 1);

    merger.connect(this.binauralGain);
    this.routeToMaster(this.binauralGain);

    this.binauralLeftOsc.start();
    this.binauralRightOsc.start();
    this.isBinauralActive = true;
  }

  updateBinauralSettings(baseFreq, beatFreq, volume) {
    this.binauralBaseFreq = baseFreq;
    this.binauralBeatFreq = beatFreq;
    const now = this.ctx ? this.ctx.currentTime : 0;

    if (this.binauralLeftOsc && this.ctx) {
      this.binauralLeftOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
    }
    if (this.binauralRightOsc && this.ctx) {
      this.binauralRightOsc.frequency.setTargetAtTime(baseFreq + beatFreq, now, 0.05);
    }
    if (this.binauralGain && this.ctx && volume !== undefined) {
      this.binauralGain.gain.setTargetAtTime(Math.max(0, volume), now, 0.05);
    }
  }

  stopBinauralBeats() {
    if (this.binauralLeftOsc && this.binauralRightOsc) {
      try {
        const now = this.ctx.currentTime;
        if (this.binauralGain) {
          this.binauralGain.gain.setTargetAtTime(0, now, 0.08);
        }
        setTimeout(() => {
          if (this.binauralLeftOsc) {
            this.binauralLeftOsc.stop();
            this.binauralLeftOsc.disconnect();
            this.binauralLeftOsc = null;
          }
          if (this.binauralRightOsc) {
            this.binauralRightOsc.stop();
            this.binauralRightOsc.disconnect();
            this.binauralRightOsc = null;
          }
        }, 100);
      } catch (e) {}
    }
    this.isBinauralActive = false;
  }

  /**
   * Smooth volume fade out for Sleep Timer (linear to avoid waking user)
   */
  fadeMasterOut(durationSeconds = 60, onComplete = null) {
    if (!this.masterGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.linearRampToValueAtTime(0, now + durationSeconds);
    setTimeout(() => {
      this.pause();
      if (onComplete) onComplete();
    }, durationSeconds * 1000);
  }
}

// Global Export
window.tinnitusAudio = new TinnitusAudioEngine();
