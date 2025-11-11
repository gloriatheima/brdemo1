<template>
  <div class="puppetron container py-4 make-browser-talk">
    <h1>Make Your Browser Talk</h1>

    <!-- Friendly status / errors (aria-live) -->
    <div aria-live="polite" v-if="lastError" class="status" style="color:#b00020; margin-bottom:0.6rem;">
      {{ lastError }}
    </div>

    <form id="formtron" @submit.prevent="onSubmit" class="talk-form">
      <div class="mode-row">
        <label><input type="radio" v-model="mode" value="text" /> Text</label>
        <label><input type="radio" v-model="mode" value="selector" /> URL + Selector</label>
      </div>

      <!-- Text mode -->
      <div v-if="mode === 'text'">
        <label class="label">Enter text for the browser to speak</label>
        <textarea
          v-model="text"
          placeholder="Type something for the browser to say..."
          rows="6"
          @input="onTextInput"
        ></textarea>
        <!-- display current length / max -->
        <div style="width:90%; max-width:900px; text-align:left; font-size:12px; color:#666;">
          {{ text.length }} / {{ MAX_CHARS }} chars
        </div>
      </div>

      <!-- Selector mode -->
      <div v-else class="selector-mode">
        <label class="label">Target URL</label>
        <input type="url" v-model="url" placeholder="https://example.com" />
        <label class="label" style="margin-top:0.5rem">CSS selector to extract (single)</label>
        <input type="text" v-model="selector" placeholder="e.g. h1, .article .title" />
        <p class="hint">Worker will call BR scrape with this selector and turn the extracted text into speech.</p>

        <!-- Show extracted text preview (if backend returned it) -->
        <div v-if="extractedText || rawBrJson" class="extracted-preview card card-body" style="margin-top:0.6rem; text-align:left;">
          <strong>Extracted text (preview):</strong>
          <p v-if="extractedText">{{ extractedText }}</p>
          <p v-else style="color:#666;font-style:italic;">(no text extracted)</p>

          <div style="margin-top:0.4rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button type="button" @click="useExtractedText" :disabled="!extractedText">Use as text</button>

            <!-- Added: toggle to show raw BR JSON for debugging -->
            <button type="button" @click="showRawBrJson = !showRawBrJson" :disabled="!rawBrJson">
              {{ showRawBrJson ? 'Hide raw BR JSON' : 'Show raw BR JSON' }}
            </button>

            <!-- Optional: copy raw JSON to clipboard -->
            <button type="button" @click="copyRawBrJson" :disabled="!rawBrJson">Copy raw JSON</button>

            <!-- Added: download raw JSON -->
            <button type="button" @click="downloadRawBrJson" :disabled="!rawBrJson">Download JSON</button>
          </div>

          <!-- Added: raw BR JSON viewer (collapsible) with improved style -->
          <div v-if="showRawBrJson" class="raw-json-wrapper" aria-hidden="false">
            <div class="raw-json-toolbar">
              <span class="badge">Raw BR JSON</span>
              <small class="muted"> — debug view (collapsed by default)</small>
            </div>
            <pre class="raw-json-pre" v-text="rawBrJsonPreview"></pre>
          </div>
        </div>
      </div>

      <div class="controls-row">
        <div class="action-buttons">
          <!-- main action: Generate & Play -->
          <button
            type="button"
            @click="requestTts"
            :disabled="!canRequest || isLoading"
            aria-label="Generate and play audio"
          >
            {{ isLoading ? 'Generating...' : 'Generate & Play' }}
          </button>

          <!-- playback controls -->
          <button type="button" @click="pauseAudio" :disabled="!isPlaying || isPaused" aria-label="Pause">⏸ Pause</button>
          <button type="button" @click="resumeAudio" :disabled="!isPaused" aria-label="Resume">▶ Resume</button>
          <button type="button" @click="stopAudio" :disabled="!isPlaying && !isPaused" aria-label="Stop">■ Stop</button>

          <!-- download button (enabled once audio is available) -->
          <button type="button" @click="downloadAudio" :disabled="!audioUrl" aria-label="Download audio">⬇ Download</button>
        </div>
      </div>

      <!-- visualizer + optional current word highlight (only for text-mode preview) -->
      <div class="visual-row">
        <div class="visualizer" :class="{ playing: isPlaying || isLoading }" aria-hidden="true">
          <div v-for="n in 12" :key="n" class="bar" :style="barStyle(n)"></div>
        </div>

        <div class="spoken-preview" v-if="mode === 'text' && words.length">
          <span v-for="(w, idx) in words" :key="idx" :class="{ highlight: idx === currentWordIndex }">
            {{ w }}
          </span>
        </div>
      </div>

      <!-- START: Single collapsible card (only one card kept as requested) -->
      <div id="accordionExample" aria-multiselectable="false" style="width:90%; max-width:900px; margin-top:1rem;">
        <!-- Only one card retained: image/card for BR integrations -->
        <b-card no-body class="mb-2">
          <b-card-header
            header-tag="header"
            class="p-0"
            role="tab"
            id="headingThree"
          >
            <h2 class="mb-0">
              <b-button
                v-b-toggle.collapseThree
                variant="link"
                block
                class="text-left"
              >
                Make Your Browser Talk 的实现逻辑
              </b-button>
            </h2>
          </b-card-header>

          <!-- v-model added to control open state; image will render only when opened (lazy) -->
          <b-collapse
            id="collapseThree"
            accordion="accordionExample"
            class="border-top"
            role="tabpanel"
            aria-labelledby="headingThree"
            v-model="collapseThreeOpen"
          >
            <b-card-body>
              前端向 Worker 发送请求，body 可以是直接 text，也可以是 url+selector（前端可提供 selector 文本框）

              <!-- 在这里插入图片：图片使用 data 中的 imageUrl -->
              <!-- v-if ensures the <img> is only rendered when collapse is open (用户未点击时隐藏) -->
              <div class="diagram-wrapper mt-3" v-if="collapseThreeOpen">
                <img
                  v-if="imageUrl"
                  :src="imageUrl"
                  :alt="imageAlt"
                  class="img-fluid diagram-img"
                />
                <div v-else class="muted" style="font-size:13px; color:#567;">Loading image...</div>
              </div>
            </b-card-body>
          </b-collapse>
        </b-card>
      </div>
      <!-- END: Single collapsible card -->

    </form>

    <footer>
      <p>
        Make your browser talk via server TTS (BR → Workers AI → R2). Theme matches ContentGen.
      </p>
    </footer>
  </div>
</template>

<script>
export default {
  name: "MakeBrowserTalk",

  data() {
    return {
      // mode: 'text' (direct text) or 'selector' (url + selector)
      mode: "text",
      text: "",
      url: "",
      selector: "",
      // playback / generation state
      isLoading: false,
      isPlaying: false,
      isPaused: false,
      audioKey: null,
      audioUrl: null, // may be blob: URL
      audioEl: null,
      // words highlighting (for text mode)
      words: [],
      currentWordIndex: -1,
      highlightTimer: null,
      // visualizer seed
      seed: Math.random(),
      // extracted text from selector-mode backend scrape
      extractedText: null,
      // friendly error status
      lastError: null,
      // abort controller for fetches (optional cancellation)
      ttsAbortController: null,

      // Added: store raw BR JSON returned from backend (string or object)
      rawBrJson: null,
      // Added: toggle whether to show raw BR JSON in UI
      showRawBrJson: false,

      // Added: image asset info for the new BR integration card (lazy loaded)
      imageUrl: null, // lazy: will be set when collapseThreeOpen becomes true
      imageAlt: 'Browser Rendering integration diagram',

      // Added: toggle for collapseThree to control image visibility (collapsed by default)
      collapseThreeOpen: false,
    };
  },

  computed: {
    canRequest() {
      if (this.mode === "text") {
        return this.text.trim().length > 0;
      }
      // selector mode requires both url and selector
      return this.mode === "selector" && this.url.trim().length > 0 && this.selector.trim().length > 0;
    },

    // Added: provide a pretty preview of rawBrJson (stringified / pretty-printed)
    rawBrJsonPreview() {
      if (!this.rawBrJson) return "";
      if (typeof this.rawBrJson === "string") {
        // if looks like JSON string, try to pretty print
        try {
          const parsed = JSON.parse(this.rawBrJson);
          return JSON.stringify(parsed, null, 2);
        } catch (e) {
          return this.rawBrJson;
        }
      } else {
        try {
          return JSON.stringify(this.rawBrJson, null, 2);
        } catch (e) {
          return String(this.rawBrJson);
        }
      }
    }
  },

  // constant for maximum chars (keeps parity with backend)
  // you can adjust or fetch from server if desired
  MAX_CHARS: 8000,

  mounted() {
    // create a hidden audio element to control playback
    this.audioEl = document.createElement("audio");
    this.audioEl.preload = "auto";
    // we use anonymous CORS in case fetching from different origins
    try { this.audioEl.crossOrigin = "anonymous"; } catch (e) { console.debug('crossOrigin not supported:', e); }
    this.audioEl.onended = this.onAudioEnded;
    this.audioEl.onpause = () => { this.isPaused = true; };
    this.audioEl.onplay = () => { this.isPaused = false; };
    // for metadata loaded -> setup highlight timing
    this.audioEl.onloadedmetadata = this.onAudioMetadata;
    // attach to DOM invisibly so some browsers allow autoplay after user gesture
    this.audioEl.style.display = "none";
    try { document.body.appendChild(this.audioEl); } catch (e) { console.debug('append audioEl failed:', e); }
    // initialize words split if there's prefilled text
    this.onTextInput();
  },

  beforeUnmount() {
    this.cleanupAudio();
  },

  watch: {
    // When user opens the collapse for the first time, lazy-load the image asset
    collapseThreeOpen(newVal) {
      if (newVal && !this.imageUrl) {
        try {
          // require only when opened to avoid preloading during initial page load
          // If you prefer runtime URL from /public, change this to a static path instead.
          this.imageUrl = require('@/assets/brTalkFlow.drawio.png');
        } catch (e) {
          console.debug('lazy load image failed', e);
          this.imageUrl = null;
        }
      }
    }
  },

  methods: {
    onTextInput() {
      // keep words for highlighting
      this.words = this.text.trim().length ? this.text.split(/\s+/) : [];
      this.currentWordIndex = -1;
    },

    // main entry: request backend to generate TTS and play
    async requestTts() {
      if (!this.canRequest || this.isLoading) return;
      this.isLoading = true;
      this.lastError = null;
      this.stopAudio(); // ensure clean state

      // abort any previous fetches
      try { if (this.ttsAbortController) this.ttsAbortController.abort(); } catch (e) { console.debug('abort previous controller failed:', e); }
      this.ttsAbortController = new AbortController();

      const payload = {};
      if (this.mode === "text") {
        payload.text = this.text;
      } else {
        payload.url = this.url;
        payload.selector = this.selector;
      }
      payload.format = "mp3";

      try {
        const resp = await fetch("/talk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: this.ttsAbortController.signal,
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new Error(`Server ${resp.status}: ${txt}`);
        }
        const j = await resp.json();
        if (!j.key) throw new Error("No key returned from server");
        this.audioKey = j.key;

        // If backend returned extractedText (selector mode) save & show it
        if (j.extractedText) {
          // Added: keep original/raw BR JSON and attempt to parse/clean it into plain text
          this.rawBrJson = j.extractedText;
          // Try to parse and extract readable text; fallback to the raw string
          const cleaned = this.tryParseAndExtract(j.extractedText);
          this.extractedText = cleaned || (typeof j.extractedText === 'string' ? j.extractedText : JSON.stringify(j.extractedText));
        } else {
          this.extractedText = null;
          this.rawBrJson = null;
        }

        // Now fetch the audio blob and play
        await this.playKey(j.key);
      } catch (err) {
        console.error("TTS request failed", err);
        this.lastError = "TTS request failed: " + (err.message || err);
        // Also inform user
        alert("TTS request failed: " + (err.message || err));
      } finally {
        this.isLoading = false;
        // clear abort controller (done)
        this.ttsAbortController = null;
      }
    },

    // Added helper: attempt to parse BR extractedText (which may be JSON string or object)
    // and return a human-friendly text when possible.
    tryParseAndExtract(raw) {
      try {
        if (!raw) return "";
        let parsed = raw;
        // If it's a JSON string, parse it
        if (typeof raw === "string") {
          // Heuristic: often the backend here returns a JSON string; try parse
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            // not JSON - it might be plain text or HTML; return stripped HTML/plain text
            const s = raw.trim();
            if (s.startsWith("{") || s.startsWith("[")) {
              // looks like JSON but parse failed; return raw
              return raw;
            }
            // strip HTML tags if present
            return this.stripHtml(s);
          }
        }

        // At this point parsed is an object (or array)
        // Common BR shapes we handle:
        // - { success: true, result: [ { results: [ { text, html } ], selector } ] }
        // - { result: { html: "...", text: "..." } }
        // - { result: "..." } (string)
        if (!parsed) return "";

        // If parsed.result is array -> find first non-empty text/html
        if (Array.isArray(parsed.result) && parsed.result.length) {
          for (const item of parsed.result) {
            // item may contain results array
            if (Array.isArray(item.results) && item.results.length) {
              const first = item.results[0];
              if (first) {
                if (first.text && String(first.text).trim()) return String(first.text).trim();
                if (first.html && String(first.html).trim()) return this.stripHtml(String(first.html));
              }
            }
            // fallback: if item has text/html directly
            if (item.text && String(item.text).trim()) return String(item.text).trim();
            if (item.html && String(item.html).trim()) return this.stripHtml(String(item.html));
          }
        }

        // If parsed.result is object
        if (typeof parsed.result === "object" && parsed.result !== null) {
          if (parsed.result.text && String(parsed.result.text).trim()) return String(parsed.result.text).trim();
          if (parsed.result.html && String(parsed.result.html).trim()) return this.stripHtml(String(parsed.result.html));
          // support nested results
          if (Array.isArray(parsed.result.results) && parsed.result.results.length) {
            const r0 = parsed.result.results[0];
            if (r0) {
              if (r0.text && String(r0.text).trim()) return String(r0.text).trim();
              if (r0.html && String(r0.html).trim()) return this.stripHtml(String(r0.html));
            }
          }
        }

        // If parsed.result is string
        if (typeof parsed.result === "string") {
          const s = parsed.result.trim();
          return this.stripHtml(s);
        }

        // Try top-level text/html/content
        if (parsed.text && String(parsed.text).trim()) return String(parsed.text).trim();
        if (parsed.html && String(parsed.html).trim()) return this.stripHtml(String(parsed.html));
        if (parsed.content && String(parsed.content).trim()) return this.stripHtml(String(parsed.content));

        // Fallback: stringify parsed (for debugging)
        try {
          return JSON.stringify(parsed);
        } catch (e) {
          return String(parsed);
        }
      } catch (e) {
        console.debug("tryParseAndExtract failed:", e);
        return "";
      }
    },

    // Added helper: simple HTML stripper for frontend preview
    stripHtml(html) {
      if (!html) return "";
      return String(html)
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/<\/?[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    },

    // play audio by R2 key - fetch blob -> createObjectURL for robust control & download
    async playKey(key) {
      // build audio URL (same origin worker exposes /audio/:key)
      const audioEndpoint = `/audio/${encodeURIComponent(key)}`;

      try {
        // revoke previous blob URL if any
        if (this.audioUrl && this.audioUrl.startsWith("blob:")) {
          try { URL.revokeObjectURL(this.audioUrl); } catch (e) { console.debug('revoke previous blob failed:', e); }
        }

        // fetch audio blob to detect errors and allow download
        const resp = await fetch(audioEndpoint);
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new Error(`Audio fetch failed ${resp.status}: ${txt}`);
        }
        const blob = await resp.blob();
        this.audioUrl = URL.createObjectURL(blob);
        this.audioEl.src = this.audioUrl;

        // ensure autoplay works (requestTts is user-initiated)
        await this.audioEl.play();
        this.isPlaying = true;
        this.isPaused = false;

        // if text mode, prepare highlighting
        if (this.mode === "text") {
          this.words = this.text.trim().length ? this.text.split(/\s+/) : [];
          this.currentWordIndex = -1;
          // highlight timing will be set on metadata load
        } else {
          // clear preview/highlight for selector mode
          this.words = [];
          this.currentWordIndex = -1;
        }
      } catch (err) {
        console.error("play failed", err);
        this.lastError = "Audio play failed: " + (err.message || err);
        alert("Audio play failed: " + (err.message || err));
        this.isPlaying = false;
        this.isPaused = false;
      }
    },

    // when metadata available and in text mode, setup approximate highlighting
    onAudioMetadata() {
      if (!this.audioEl || !this.audioEl.duration || this.mode !== "text" || this.words.length === 0) return;
      this.clearHighlightTimer();
      const totalMs = Math.max(1000, Math.floor(this.audioEl.duration * 1000));
      const stepMs = Math.max(120, Math.floor(totalMs / this.words.length));
      // use setInterval to increment currentWordIndex periodically while playing
      this.highlightTimer = setInterval(() => {
        if (!this.isPlaying || this.isPaused) return;
        if (this.currentWordIndex < this.words.length - 1) {
          this.currentWordIndex++;
        }
      }, stepMs);
    },

    pauseAudio() {
      if (!this.audioEl) return;
      try {
        this.audioEl.pause();
        this.isPaused = true;
      } catch (e) {
        console.debug('pauseAudio error:', e);
      }
    },

    resumeAudio() {
      if (!this.audioEl) return;
      try {
        this.audioEl.play();
        this.isPaused = false;
      } catch (e) {
        console.debug('resumeAudio error:', e);
      }
    },

    stopAudio() {
      if (!this.audioEl) return;
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } catch (e) {
        console.debug('stopAudio error:', e);
      }
      this.isPlaying = false;
      this.isPaused = false;
      this.clearHighlightTimer();
      this.currentWordIndex = -1;
    },

    onAudioEnded() {
      this.isPlaying = false;
      this.isPaused = false;
      this.clearHighlightTimer();
      this.currentWordIndex = -1;
    },

    clearHighlightTimer() {
      if (this.highlightTimer) {
        clearInterval(this.highlightTimer);
        this.highlightTimer = null;
      }
    },

    cleanupAudio() {
      if (this.audioEl) {
        this.audioEl.onended = null;
        this.audioEl.onpause = null;
        this.audioEl.onplay = null;
        this.audioEl.onloadedmetadata = null;
        try {
          this.audioEl.pause();
        } catch (err) {
          // swallow errors when pausing during unmount
          console.debug('audio pause during cleanup failed:', err);
        }
        try {
          // remove from DOM if we appended it in mounted
          if (this.audioEl.parentNode) this.audioEl.parentNode.removeChild(this.audioEl);
        } catch (e) { console.debug('remove audioEl from DOM failed:', e); }
        this.audioEl = null;
      }
      // revoke blob URL if exists
      if (this.audioUrl && this.audioUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(this.audioUrl); } catch (e) { console.debug('revoke audioUrl failed:', e); }
      }
      this.audioUrl = null;
      this.clearHighlightTimer();
    },

    // download current audio (uses blob URL if present)
    downloadAudio() {
      if (!this.audioUrl) return;
      try {
        const a = document.createElement('a');
        a.href = this.audioUrl;
        a.download = `${this.audioKey || 'audio'}.mp3`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        console.error("download failed", e);
        alert("Download failed: " + (e.message || e));
      }
    },

    // use backend extracted text as current text (selector -> text)
    useExtractedText() {
      if (!this.extractedText) return;
      // New behavior: ask user whether to play the already-generated audio now.
      // This keeps the "Use as text" behavior safe (won't autoplay unexpectedly)
      // while allowing a quick one-click play if the user confirms.
      const playNow = confirm("Insert extracted text into the textarea and play the generated audio now?");
      this.mode = "text";
      this.text = this.extractedText;
      this.onTextInput();
      if (playNow) {
        // If there's an existing audioKey (from the previous selector-mode generation), play it.
        if (this.audioKey) {
          this.playKey(this.audioKey).catch((e) => {
            console.debug("playKey after useExtractedText failed:", e);
          });
        } else {
          // Otherwise trigger a regeneration+play (user expectation)
          // This will call the backend to generate audio for the inserted text.
          this.requestTts();
        }
      }
    },

    // Added: copy raw BR JSON to clipboard for debugging
    async copyRawBrJson() {
      if (!this.rawBrJson) return;
      try {
        const textToCopy = (typeof this.rawBrJson === 'string') ? this.rawBrJson : JSON.stringify(this.rawBrJson);
        await navigator.clipboard.writeText(textToCopy);
        // small visual feedback could be added later
        alert('Raw BR JSON copied to clipboard');
      } catch (e) {
        console.error('copyRawBrJson failed', e);
        alert('Copy failed: ' + (e.message || e));
      }
    },

    // Added: download raw BR JSON as a file
    downloadRawBrJson() {
      if (!this.rawBrJson) return;
      try {
        const textToSave = (typeof this.rawBrJson === 'string') ? this.rawBrJson : JSON.stringify(this.rawBrJson, null, 2);
        const blob = new Blob([textToSave], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `raw-br-${this.audioKey || 'extracted'}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // revoke after a short delay
        setTimeout(() => {
          try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        }, 5000);
      } catch (e) {
        console.error('downloadRawBrJson failed', e);
        alert('Download failed: ' + (e.message || e));
      }
    },

    // visualizer per-bar style uses seed to produce variety
    barStyle(n) {
      const base = 6 + ((n + Math.floor(this.seed * 10)) % 8) * 2;
      return { height: base + "px" };
    },

    // form submit alias (also triggers request)
    onSubmit() {
      this.requestTts();
    }
  }
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css?family=Signika:400,700');

.make-browser-talk .puppetron,
.puppetron,
.puppetron * {
  font-family: 'Signika', sans-serif;
  color: #00667A;
  text-align: center;
}

.puppetron {
  margin: auto;
  width: 100%;
  padding: 0 0.5em;
}

h1 {
  font-size: 48px;
  margin: 0 0 0.5rem;
  color: #0b5960;
  text-shadow: 0 1px 12px #60E8EE;
}

.mode-row {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 0.5rem;
}

/* Form */
.talk-form {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.label {
  font-weight: 600;
  margin-bottom: 0.4rem;
  color: #064b52;
}

textarea, input[type="url"], input[type="text"], select {
  width: 90%;
  max-width: 900px;
  padding: 0.6rem;
  border: 0;
  background: #f0ffff;
  font-size: 16px;
  color: #063a3b;
  box-shadow: 0 1px 10px rgba(96,232,238,0.12);
  margin-bottom: 0.5rem;
}

.hint {
  font-size: 12px;
  color: #666;
  max-width: 900px;
  text-align: left;
}

/* Controls */
/* 关键修改：把按钮容器整体居中显示（改为 center），并使按钮组水平居中 */
.controls-row {
  display: flex;
  flex-direction: row;
  justify-content: center; /* <- 由 space-between 改为 center */
  gap: 1rem;
  width: 90%;
  max-width: 900px;
  margin-top: 0.4rem;
  align-items: center;
}

/* 保证 action-buttons 在容器中水平排列并在小屏幕自动换行 */
.action-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center; /* 居中按钮组 */
  flex-wrap: wrap;
}

/* 给按钮合适的最小宽度并居中对齐（看起来更整齐） */
.action-buttons button {
  background: #0e6069;
  color: white;
  border: 0;
  padding: 0.6rem 0.9rem;
  min-width: 140px; /* 适度加宽按钮，让视觉更平衡；按需调整 */
  box-shadow: 0 1px 10px #60E8EE;
  cursor: pointer;
  font-size: 16px;
  text-align: center;
}
.action-buttons button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Raw JSON viewer styles (added) */
.raw-json-wrapper {
  margin-top: 0.6rem;
  border-radius: 6px;
  background: linear-gradient(180deg, #fafefd, #f0fcfc);
  padding: 0.4rem;
  box-shadow: 0 1px 6px rgba(6,75,82,0.04);
}
.raw-json-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.raw-json-pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace;
  font-size: 13px;
  color: #013033;
  background: #f6f9f9;
  border: 1px solid rgba(6,75,82,0.06);
  border-radius: 6px;
  padding: 0.6rem;
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.badge {
  background: #e6fbfb;
  color: #0b5960;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 12px;
}
.muted {
  color: #567;
  font-size: 12px;
}

/* Diagram / image styles (added) */
.diagram-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 0.6rem;
}
.diagram-img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  box-shadow: 0 4px 18px rgba(6,75,82,0.06);
  border: 1px solid rgba(6,75,82,0.04);
}

/* Panels row - simple collapse behavior */
.panels-row {
  width: 90%;
  max-width: 900px;
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}
.col {
  flex: 1 1 45%;
  min-width: 260px;
}
.collapse-panel {
  display: none;
  transition: max-height 0.22s ease;
}
.collapse-panel.show {
  display: block;
}
.card.card-body {
  background: #eafdfd;
  border-radius: 6px;
  padding: 0.6rem;
  color: #063a3b;
  box-shadow: 0 1px 8px rgba(6,75,82,0.06);
}
.panel-text span {
  padding-right: 0.25rem;
}
.panel-text span.highlight {
  background: linear-gradient(90deg, rgba(96,232,238,0.25), rgba(6,75,82,0.08));
  box-shadow: 0 1px 6px rgba(96,232,238,0.08);
  border-radius: 3px;
  padding: 0.05rem 0.18rem;
}

/* Visualizer */
.visual-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1rem;
  width: 90%;
  max-width: 900px;
}

.visualizer {
  display: flex;
  gap: 4px;
  align-items: end;
  height: 48px;
  margin-bottom: 0.6rem;
  transition: opacity 0.2s ease;
  opacity: 0.25;
}
.visualizer.playing {
  opacity: 1;
}

.visualizer .bar {
  width: 6px;
  background: linear-gradient(180deg, #60E8EE, #0b5960);
  border-radius: 2px;
  transform-origin: bottom center;
  animation-name: pulse;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  animation-duration: 700ms;
}
.visualizer.playing .bar:nth-child(odd) {
  animation-duration: 560ms;
}
.visualizer.playing .bar:nth-child(even) {
  animation-duration: 780ms;
}
.visualizer.playing .bar:nth-child(3n) {
  animation-duration: 430ms;
}
.visualizer.playing .bar {
  animation-delay: calc(var(--i, 0) * 40ms);
}

@keyframes pulse {
  0% { transform: scaleY(0.2); opacity: 0.6; }
  50% { transform: scaleY(1.4); opacity: 1; }
  100% { transform: scaleY(0.2); opacity: 0.6; }
}

/* spoken preview with highlight fallback */
.spoken-preview {
  width: 100%;
  max-width: 900px;
  padding: 0.6rem;
  background: rgba(6, 75, 82, 0.05);
  color: #063a3b;
  border-radius: 6px;
  text-align: left;
  font-size: 16px;
  line-height: 1.5;
  display: block;
  overflow-wrap: break-word;
  margin-top: 0.6rem;
}

.spoken-preview span {
  padding-right: 0.25rem;
}
.spoken-preview span.highlight {
  background: linear-gradient(90deg, rgba(96,232,238,0.25), rgba(6,75,82,0.08));
  box-shadow: 0 1px 6px rgba(96,232,238,0.08);
  border-radius: 3px;
  padding: 0.05rem 0.18rem;
}

/* Footer */
footer {
  margin-top: 1.25rem;
  font-size: 14px;
  color: #0b5960;
}

/* responsive */
@media (max-width: 720px) {
  .controls-row { flex-direction: column; align-items: center; }
  .action-buttons { justify-content: center; }
  .panels-row { flex-direction: column; }
  .raw-json-pre { font-size: 12px; }
  .diagram-img { max-width: 100%; height: auto; }
}
</style>