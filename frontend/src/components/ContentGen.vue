<template>
  <div class="puppetron container py-4">
    <h1>BR REST API</h1>

    <form ref="formtron" id="formtron" @submit.prevent="onSubmit">
      <input
        type="url"
        name="url"
        v-model="url"
        required
        placeholder="Enter a URL"
        @paste="onPaste"
        @focus="onFocus"
        @blur="onBlur"
      />
      <br />

      <!-- Buttons for all supported backend actions -->
      <div class="actions-grid">
        <button
          v-for="act in actions"
          :key="act"
          type="submit"
          :name="act"
          @click="setAction(act)"
          :class="{ active: action === act }"
        >
          {{ labelFor(act) }}
        </button>
      </div>

      <!-- Scrape selectors textarea (only visible when scrape is selected) -->
      <div v-if="action === 'scrape'" class="scrape-controls">
        <label for="selectors"><strong>Scrape 标签选择器 (每行一个)</strong></label>
        <textarea
          id="selectors"
          v-model="selectors"
          placeholder="输入 CSS 选择器, 每行一个. 如:h1 ｜ a ｜ div | .article | .title 等"
          rows="6"
        ></textarea>
        <p class="hint">如果留空，则只会使用 URL 调用抓取程序.</p>
      </div>
    </form>

    <footer>
      <p>
        REST API 为常见的浏览器操作提供端点，例如屏幕截图、提取 HTML 内容、生成 PDF 等。以下是可用选项：<br>
        <ul>
           
          <li>/content - Fetch HTML</li>
          <li>/screenshot - Capture screenshot</li>
          <li>/pdf - Render PDF</li>
          <li>/snapshot - Take a webpage snapshot</li>
          <li>/scrape - Scrape HTML elements</li>
          <li>/json - Capture structured data using AI</li>
          <li>/links - Retrieve links from a webpage</li>
          <li>/markdown - Extract Markdown from a webpage</li>
        </ul>
      </p>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'ContentGenPuppetron',

  data() {
    return {
      url: '',
      action: 'content',
      protocol: 'http://',
      currentObjectUrl: null,
      // list of supported backend routes to display as buttons
      actions: [
        'content',
        'snapshot',
        'screenshot',
        'pdf',
        'scrape',
        'json',
        'links',
        'markdown'
      ],
      // selectors textarea model for scrape
      selectors: ''
    };
  },
  methods: {
    encode(u) {
      return encodeURIComponent(u);
    },

    setAction(act) {
      // ensure we only set allowed actions used by backend
      if (this.actions.includes(act)) {
        this.action = act;
      } else {
        this.action = 'content';
      }
    },

    labelFor(act) {
      // Human-friendly labels (you can customize)
      const map = {
        content: 'Content',
        snapshot: 'Snapshot',
        screenshot: 'Screenshot',
        pdf: 'PDF',
        scrape: 'Scrape',
        json: 'JSON',
        links: 'Links',
        markdown: 'Markdown'
      };
      return map[act] || act;
    },

    async onSubmit() {
      if (!this.url || !(this.url.startsWith('http://') || this.url.startsWith('https://'))) {
        alert('Please enter a valid URL including http:// or https://');
        return;
      }

      const params = new URLSearchParams({ url: this.url });

      // include viewport params only for endpoints that normally use them
      if (this.action === 'screenshot' || this.action === 'snapshot') {
        params.set('width', String(window.innerWidth));
        params.set('height', String(window.innerHeight));
      }

      // scrape: if selectors provided, encode as elements JSON array per Cloudflare example
      if (this.action === 'scrape') {
        const lines = (this.selectors || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (lines.length) {
          const elements = lines.map(s => ({ selector: s }));
          // JSON.stringify will be percent-encoded by URLSearchParams when setting as value
          params.set('elements', JSON.stringify(elements));
        }
        // If selectors empty, we still include url param (server-side will accept url-only fallback)
      }

      const endpoint = `/${this.action}?${params.toString()}`;

      try {
        const resp = await fetch(endpoint, { method: 'GET' });

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          throw new Error(`Server returned ${resp.status}: ${txt}`);
        }

        const ct = (resp.headers.get('content-type') || '').toLowerCase();

        if (ct.includes('image/')) {
          const blob = await resp.blob();
          this.applyPreviewFromBlob(blob, 'image');
        } else if (ct.includes('application/pdf')) {
          const blob = await resp.blob();
          this.applyPreviewFromBlob(blob, 'pdf');
        } else if (ct.includes('text/html') || ct.includes('application/json') || ct.includes('text/plain')) {
          const text = await resp.text();
          if (ct.includes('text/html')) {
            this.showHtmlPreview(text);
          } else if (ct.includes('application/json')) {
            try {
              const parsed = JSON.parse(text);
              this.showHtmlPreview(`<pre>${this.escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`);
            } catch {
              this.showHtmlPreview(`<pre>${this.escapeHtml(text)}</pre>`);
            }
          } else {
            this.showHtmlPreview(`<pre>${this.escapeHtml(text)}</pre>`);
          }
        } else {
          // fallback: treat as binary and trigger a download
          const blob = await resp.blob();
          this.applyPreviewFromBlob(blob, 'binary');
        }
      } catch (err) {
        console.error(err);
        alert('Request failed: ' + (err.message || err));
      }
    },

    applyPreviewFromBlob(blob, kind) {
      // Revoke previous object URL if present
      if (this.currentObjectUrl) {
        try { URL.revokeObjectURL(this.currentObjectUrl); } catch (e) { /* noop */ }
        this.currentObjectUrl = null;
      }

      const objectUrl = URL.createObjectURL(blob);
      this.currentObjectUrl = objectUrl;

      // Use 'kind' to decide how to present the blob (prevents eslint no-unused-vars)
      // - images and pdfs: open in a new tab
      // - binary/other: trigger download with a suggested filename
      if (kind === 'image' || kind === 'pdf' || kind === 'binary') {
        // For PDFs and images, opening in a new tab provides quick preview
        window.open(objectUrl, '_blank');
        return;
      }

      // fallback: download
      const ext = kind === 'pdf' ? 'pdf' : (kind === 'image' ? 'png' : 'bin');
      const filename = this.suggestFilename(ext);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      // Append to DOM to make click work in some browsers
      document.body.appendChild(a);
      a.click();
      a.remove();
    },

    showHtmlPreview(html) {
      const w = window.open('', '_blank');
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
      } else {
        alert('Preview blocked by browser. You can configure to allow popups for preview.');
      }
    },

    onPaste(e) {
      const text = e.clipboardData.getData('text') || '';
      if (text.startsWith('http://') || text.startsWith('https://')) {
        e.preventDefault();
        this.url = text;
      }
    },

    onFocus() {
      if (this.url.trim() === '') {
        this.url = this.protocol;
      }
    },

    onBlur() {
      if (this.url.trim() === this.protocol) {
        this.url = '';
      }
    },

    suggestFilename(ext) {
      try {
        const u = new URL(this.url);
        const re = new RegExp('[\\\\/\\?=&:\\s]+', 'g');
        const sanitize = (s) => s.replace(re, '_').replace(/^_+|_+$/g, '');
        const hostPart = sanitize(u.hostname || 'site');
        const pathPart = sanitize(u.pathname || '');
        const name = pathPart ? `${hostPart}_${pathPart}` : hostPart;
        return `capture_${name}.${ext}`;
      } catch {
        return `capture.${ext}`;
      }
    },

    escapeHtml(s) {
      return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
  },

  beforeDestroy() {
    if (this.currentObjectUrl) {
      try { URL.revokeObjectURL(this.currentObjectUrl); } catch (e) { /* noop */ }
    }
  },
  beforeUnmount() {
    if (this.currentObjectUrl) {
      try { URL.revokeObjectURL(this.currentObjectUrl); } catch (e) { /* noop */ }
    }
  }
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css?family=Signika:400,700');

.puppetron {
  margin: auto;
  width: 100%;
  padding: 0 0.5em;
  text-align: center;
}
.puppetron,
.puppetron * {
  font-family: 'Signika', sans-serif;
  font-weight: 400;
  color: #00667A;
  text-align: center;
}
h1 {
  font-weight: 700;
  font-size: 60px;
  text-shadow: 0 1px 20px #60E8EE;
  margin: 0 0 0.25em;
}

/* URL input */
input[type='url'] {
  display: inline-block;
  width: 90%;
  max-width: 600px;
  padding: 0.45em;
  margin: 0.5em;
  border: 0;
  background-color: #D7FCFD;
}
input[type='url']:focus {
  outline: 3px solid #00667A;
}

/* Actions grid */
.actions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
}
.actions-grid button {
  border-radius: 0;
  border: 0;
  padding: 0.8em 1.5em;
  min-width: 160px;
  color: rgba(255, 255, 255, 0.95);
  background-color: #0e6069;
  box-shadow: 0 1px 10px #60E8EE;
  cursor: pointer;
  font-size: 18px;
}
.actions-grid button.active {
  outline: 3px solid #60E8EE;
  box-shadow: 0 1px 25px #60E8EE;
}
.actions-grid button:hover {
  transform: translateY(-2px);
}

/* Scrape controls */
.scrape-controls {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.scrape-controls textarea {
  width: 90%;
  max-width: 800px;
  min-height: 96px;
  padding: 0.6rem;
  font-size: 14px;
}
.scrape-controls .hint {
  font-size: 12px;
  color: #666;
  margin-top: 0.5rem;
}
/* ====== 新增：让页面内的列表左对齐，同时保留列表块居中（首选） ====== */
/* 使 .puppetron 下的 ul/ol 项目内部左对齐，但把整个列表块居中显示 */
.puppetron ul,
.puppetron ol {
  text-align: left;           /* 列表项内部左对齐 */
  display: inline-block;      /* 让整个列表块可以被居中（由于容器是 centered） */
  margin: 0.5rem auto;        /* 列表块垂直间距并水平居中 */
  padding-left: 1.35rem;      /* 为 bullets/markers 留出左侧间距 */
  list-style-position: outside;
  max-width: 900px;           /* 可选：限制列表宽度，视页面布局调整 */
}

/* 确保每个 li 内容左对齐 */
.puppetron ul li,
.puppetron ol li {
  text-align: left;
}

/* 如果列表在 <p> 内，给出合理的间距 */
.puppetron p ul,
.puppetron p ol {
  margin-top: 0.5rem;
}

/* ====== 备选：如果你希望列表整体左靠页面（取消列表块居中），可使用下面代码（注释掉上面 inline-block 的版本） ======
.puppetron ul,
.puppetron ol {
  text-align: left;
  display: block;
  margin: 0.5rem 0;
  padding-left: 1.35rem;
}
*/

/* Footer */
footer {
  font-size: 16px;
  margin-top: 1.5rem;
}
</style>