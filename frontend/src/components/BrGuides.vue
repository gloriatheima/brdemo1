<template>
  <div class="brguides container py-4">
    <h2 class="mb-3">Browser Rendering Demo</h2>
    <p class="text-muted">
      Run headless Chrome on <a href="https://www.cloudflare.com/zh-cn/network/" target="_blank" rel="noopener noreferrer">Cloudflare's global network</a> for browser automation, web scraping, testing, and content generation.
    </p>

    <ul class="list-unstyled mt-3">
      <li v-for="(r, idx) in resources" :key="idx" class="mb-2">
        <!-- 全部使用内部路由跳转 -->
        <router-link :to="r.to" class="resource-link">
          <span class="icon-circle" aria-hidden="true">
            <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="resource-title">{{ r.title }}</span>
        </router-link>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'BrGuides',
  data() {
    return {
      // 全部改为内部路由的 to 字段。
      // 若某些路径尚未在 router 中注册，请在 src/router/index.js 中添加对应 route。
      resources: [
        // { to: '/br-guides', title: 'Browser Rendering introduction' },
        { to: '/br-introduction', title: 'BR Introduction' },
        { to: '/content-generation', title: 'BR REST API Demo' },
        { to: '/make-browser-talk', title: 'Make your browser talk' },
        // { to: '/seo-analytic', title: 'SEO analytic' }
      ]
    }
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css?family=Signika:400,700');

/* Theme aligned with MakeBrowserTalk.vue: teal/blue palette, Signika font */
.brguides,
.brguides * {
  font-family: 'Signika', sans-serif;
  color: #00667A;
}

/* Container adjustments to match MakeBrowserTalk spacing */
.brguides.container {
  padding: 0 0.5em;
}

/* Heading style consistent with MakeBrowserTalk (smaller than main page h1) */
.brguides h2 {
  font-size: 28px;
  margin: 0 0 0.5rem;
  color: #0b5960;
  font-weight: 700;
  text-shadow: 0 1px 8px rgba(96,232,238,0.06);
}

/* Muted paragraph styling */
.brguides .text-muted {
  color: #567;
  font-size: 14px;
  max-width: 900px;
  text-align: left;
}

/* Resource list layout */
.brguides ul {
  padding-left: 0;
  margin-top: 0.5rem;
  width: 100%;
  max-width: 900px;
}

/* Resource link visual style matches page theme */
.resource-link {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 0.6rem;
  border-radius: 8px;
  background: linear-gradient(180deg, #f7ffff, #eefdfd);
  color: #063a3b;
  text-decoration: none;
  box-shadow: 0 1px 8px rgba(6,75,82,0.05);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

/* Hover/focus state */
.resource-link:hover,
.resource-link:focus {
  transform: translateY(-2px);
  box-shadow: 0 6px 22px rgba(6,75,82,0.08);
  text-decoration: none;
}

/* Icon circle aligned with theme (teal-ish) */
.icon-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(180deg, #60E8EE, #0e6069);
  color: white;
  flex: 0 0 36px;
  box-shadow: 0 2px 8px rgba(14,96,105,0.12);
}

/* SVG inside icon */
.icon-circle svg {
  width: 14px;
  height: 14px;
  display: block;
}

/* Title text styling */
.resource-title {
  font-size: 16px;
  font-weight: 600;
  color: #063a3b;
  display: inline-block;
  text-align: left;
}

/* Small hint color for timestamp or small text if needed */
.resource-link .small {
  color: #567;
  font-size: 12px;
}

/* Make each list item fill container and add spacing */
.brguides li {
  list-style: none;
}

/* Responsive: stack icon and title on narrow screens */
@media (max-width: 720px) {
  .resource-link {
    display: flex;
    align-items: center;
    padding: 0.5rem;
  }
  .icon-circle {
    width: 32px;
    height: 32px;
    flex: 0 0 32px;
  }
  .resource-title {
    font-size: 15px;
  }
}

/* Keep links accessible (focus outline) */
.resource-link:focus {
  outline: 3px solid rgba(96,232,238,0.18);
  outline-offset: 2px;
}
</style>