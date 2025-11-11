<template>
  <div class="puppetron container py-4">
    <h1>Content Generation</h1>

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

      <!-- 已移除验证码（hCaptcha）部分 -->

      <button type="submit" name="screenshot" @click="setAction('screenshot')">Screenshot</button>
      <button type="submit" name="render" @click="setAction('render')">Render</button>
      <button type="submit" name="pdf" @click="setAction('pdf')">PDF</button>
    </form>

    <footer>
      <p>
        Very inspired by
        <a href="https://github.com/GoogleChrome/rendertron" target="_blank" rel="noopener noreferrer">Rendertron</a>.
        Documentation and project on
        <a href="https://github.com/cheeaun/puppetron" target="_blank" rel="noopener noreferrer">GitHub</a>.
      </p>
    </footer>
  </div>
</template>

<script>
export default {
  // 多词组件名，避免 ESLint 报错
  name: 'ContentGenPuppetron',

  data() {
    return {
      url: '',
      // 已移除 token/captcha 相关状态
      action: 'screenshot',
      protocol: 'http://',
      // internal ref for object URL (avoid leading underscore to satisfy vue/no-reserved-keys)
      currentObjectUrl: null,
    };
  },
  methods: {
    // 使用标准 encodeURIComponent 编码整个 URL 参数（更安全、直观）
    encode(u) {
      return encodeURIComponent(u);
    },

    setAction(act) {
      this.action = act;
    },

    // onSubmit 改为 fetch 并把结果展示到当前页面（如果你想仍然跳转可改回 window.location.href）
    async onSubmit() {
      // 基本校验：确保以 http(s):// 开头
      if (!this.url || !(this.url.startsWith('http://') || this.url.startsWith('https://'))) {
        alert('Please enter a valid URL including http:// or https://');
        return;
      }

      // 构建请求参数（如果你想改为跳转，把下面 fetch 替换为 window.location.href）
      const params = new URLSearchParams({ url: this.url });
      if (this.action === 'screenshot') {
        params.set('width', String(window.innerWidth));
        params.set('height', String(window.innerHeight));
      }

      const endpoint = `/${this.action}?${params.toString()}`;

      try {
        // 这里使用 fetch 将返回内容获取到当前页面（预览或下载）
        const resp = await fetch(endpoint, { method: 'GET' });

        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          throw new Error(`Server returned ${resp.status}: ${txt}`);
        }

        const ct = (resp.headers.get('content-type') || '').toLowerCase();

        // 处理二进制图片
        if (ct.includes('image/')) {
          const blob = await resp.blob();
          this.applyPreviewFromBlob(blob, 'image');
        } else if (ct.includes('application/pdf')) {
          const blob = await resp.blob();
          this.applyPreviewFromBlob(blob, 'pdf');
        } else if (ct.includes('text/html') || ct.includes('application/json') || ct.includes('text/plain')) {
          const text = await resp.text();
          // 直接在页面显示 HTML 或 pretty-print JSON/text
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
          // fallback: treat as binary
          const blob = await resp.blob();
          this.applyPreviewFromBlob(blob, 'binary');
        }
      } catch (err) {
        // show simple alert and keep console for debugging
        console.error(err);
        alert('Request failed: ' + (err.message || err));
      }
    },

    applyPreviewFromBlob(blob, kind) {
      // revoke previous object URL if present
      if (this.currentObjectUrl) {
        try {
          URL.revokeObjectURL(this.currentObjectUrl);
        } catch (e) {
          void 0;
        }
        this.currentObjectUrl = null;
      }

      const url = URL.createObjectURL(blob);
      this.currentObjectUrl = url;

      // 根据类型在页面展示（这里我们直接在 template 中没有显式预览区域，保持原样风格）
      // 你可以根据需要把 previewUrl/htmlPreview state 加入 template 来展示
      // 简单实现：打开新窗口预览（避免改变当前布局）
      if (kind === 'image' || kind === 'binary') {
        window.open(url, '_blank');
      } else if (kind === 'pdf') {
        window.open(url, '_blank');
      } else {
        // treat as download/display
        window.open(url, '_blank');
      }
    },

    showHtmlPreview(html) {
      // open a new window and write HTML (keeps current page unchanged and avoids extra template changes)
      const w = window.open('', '_blank');
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
      } else {
        // fall back to alert if popups blocked
        alert('Preview blocked by browser. You can configure to allow popups for preview.');
      }
    },

    // Paste handler: 如果粘贴的是带协议的 URL，则直接使用（避免使用复杂正则以免 ESLint 报错）
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

    // utilities
    suggestFilename(ext) {
      try {
        const u = new URL(this.url);
        // Use RegExp constructor string form to avoid unnecessary-escape ESLint errors
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
    },
  },

  // cleanup for both Vue 2 and Vue 3 hooks
  beforeDestroy() {
    if (this.currentObjectUrl) {
      try {
        URL.revokeObjectURL(this.currentObjectUrl);
      } catch (e) {
        void 0;
      }
    }
  },
  beforeUnmount() {
    if (this.currentObjectUrl) {
      try {
        URL.revokeObjectURL(this.currentObjectUrl);
      } catch (e) {
        void 0;
      }
    }
  },
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css?family=Signika:400,700');

html {
  display: flex;
  height: 100%;
}
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
.puppetron,
button,
input {
  font-size: 30px;
}
h1 {
  font-weight: 700;
  font-size: 60px;
  text-shadow: 0 1px 20px #60E8EE;
  margin: 0 0 0.25em;
}
* {
  box-sizing: border-box;
}

/* URL input */
input[type='url'] {
  display: inline-block;
  width: 90%;
  max-width: 600px;
  padding: 0.45em;
  margin: 0.5em;
  border: 0;
  border-radius: 0;
  background-color: #D7FCFD;
}
input[type='url']:focus {
  outline: 3px solid #00667A;
}

/* Buttons */
button {
  border-radius: 0;
  border: 0;
  padding: 0.45em 1em;
  margin: 0.5em;
  width: 90%;
  max-width: 15ex;
  color: rgba(255, 255, 255, 0.75);
  background-color: #00667A;
  box-shadow: 0 1px 10px #60E8EE;
  cursor: pointer;
}
button:hover {
  color: rgba(255, 255, 255, 1);
  box-shadow: 0 1px 30px #60E8EE;
  text-shadow: 0 0 5px #60E8EE;
}
button:active {
  color: rgba(255, 255, 255, 0.55);
  transform: scale(0.95);
}

/* Footer */
footer {
  font-size: 16px;
}

/* Diagram spacing */
.diagram-wrapper {
  margin-top: 1rem;
}
</style>