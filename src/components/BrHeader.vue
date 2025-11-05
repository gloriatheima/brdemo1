<template>
  <header class="app-header shadow-sm">
    <div class="container d-flex justify-content-between align-items-center py-3">
      <!-- Brand -->
      <div class="d-flex align-items-center">
        <a href="/" class="brand d-flex align-items-center text-dark text-decoration-none mr-3">
          <!-- 使用外部 SVG 图片（通过 img 避免模板解析器对 SVG 命名空间报错） -->
          <img
            :src="logoUrl"
            :alt="logoAlt"
            :width="logoWidth"
            :height="logoHeight"
            class="brand-logo mr-2"
          />
          <span class="fs-5 font-weight-bold">{{ title }}</span>
        </a>

        <!-- Desktop nav -->
        <nav class="d-none d-md-flex align-items-center ml-2">
          <a class="nav-link px-2 text-muted" href="#">Generate PDFs</a>
          <a class="nav-link px-2 text-muted" href="#">Make browser talk</a>
          <a class="nav-link px-2 text-muted" href="#">Discover all the URLs</a>
          <a class="nav-link px-2 text-muted" href="#">Redirect to CF Radar</a>
          <a class="nav-link px-2 text-muted" href="#">Crawl CF RSS</a>
        </nav>
      </div>

      <!-- Actions (保留原样) -->
      <div class="d-flex align-items-center">
        <div class="d-none d-md-flex align-items-center mr-3">
          <div class="input-group input-group-sm">
            <input
              v-model="query"
              @keyup.enter="onSearch"
              type="text"
              class="form-control"
              :placeholder="searchPlaceholder"
              aria-label="Search"
            />
            <div class="input-group-append">
              <button class="btn btn-outline-secondary" type="button" @click="onSearch" aria-label="Search button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-search" viewBox="0 0 16 16">
                  <path d="M11 6a5 5 0 1 1-10 0 5 5 0 0 1 10 0z"/>
                  <path d="M12.9 13.3 16 16.4l-1.4 1.4-3.1-3.1a6.5 6.5 0 0 1-1.5 0l-.1-.1a6.5 6.5 0 1 0 2.1-2.1l.1.1c.1.5.1 1 .0 1.5l3.1 3.1z" fill="none"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <button class="btn btn-sm btn-outline-secondary mr-2" @click="toggleTheme" :title="dark ? 'Light mode' : 'Dark mode'">
          <span v-if="!dark" class="d-inline-block" aria-hidden="true">☀️</span>
          <span v-else class="d-inline-block" aria-hidden="true">🌙</span>
        </button>

        <div class="position-relative" ref="userRef">
          <button class="btn btn-sm btn-light border rounded-circle p-0 d-flex align-items-center justify-content-center"
                  @click="toggleUser"
                  :aria-expanded="userOpen"
                  aria-label="User menu">
            <img :src="avatarUrl" alt="avatar" class="rounded-circle" width="36" height="36" />
          </button>

          <div v-if="userOpen" class="dropdown-menu dropdown-menu-right show mt-2 shadow-sm" style="min-width:160px;">
            <div class="px-3 py-2">
              <strong>{{ userName }}</strong>
              <div class="text-muted small">{{ userEmail }}</div>
            </div>
            <div class="dropdown-divider"></div>
            <a class="dropdown-item" href="#">Profile</a>
            <a class="dropdown-item" href="#">Settings</a>
            <div class="dropdown-divider"></div>
            <a class="dropdown-item text-danger" href="#" @click.prevent="signOut">Sign out</a>
          </div>
        </div>

        <button class="btn btn-sm btn-outline-secondary d-md-none ml-2" @click="mobileOpen = !mobileOpen" aria-label="Toggle menu">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-list" viewBox="0 0 16 16">
            <path d="M2.5 12.5h11M2.5 8h11M2.5 3.5h11" stroke="currentColor" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile area -->
    <div v-if="mobileOpen" class="mobile-nav d-md-none border-top">
      <div class="container py-2">
        <div class="mb-2">
          <input v-model="query" @keyup.enter="onSearch" type="text" class="form-control form-control-sm" :placeholder="searchPlaceholder" />
        </div>
        <nav class="nav flex-column">
          <a class="nav-link py-1" href="#">Generate PDFs</a>
          <a class="nav-link py-1" href="#">Make browser talk</a>
          <a class="nav-link py-1" href="#">Discover all the URLs</a>
          <a class="nav-link py-1" href="#">Redirect to CF Radar</a>
          <a class="nav-link py-1" href="#">Crawl CF RSS</a>
        </nav>
      </div>
    </div>
  </header>
</template>

<script>
export default {
  name: 'BrHeader',
  props: {
    title: { type: String, default: 'Browser Rendering Demo' },
    // 将默认 logo 指向你提供的 Cloudflare SVG URL
    logoUrl: { type: String, default: 'https://developers.cloudflare.com/_astro/logo.DAG2yejx.svg' },
    logoAlt: { type: String, default: 'Logo' },
    logoWidth: { type: [String, Number], default: 36 },
    logoHeight: { type: [String, Number], default: 36 },

    userName: { type: String, default: 'Gloria Rong' },
    userEmail: { type: String, default: '' },
    avatarUrl: {
      type: String,
      default() {
        return 'https://ui-avatars.com/api/?name=G+R&background=0D6EFD&color=fff&rounded=true';
      }
    },
    searchPlaceholder: { type: String, default: 'Search...' }
  },
  data() {
    return {
      query: '',
      userOpen: false,
      mobileOpen: false,
      dark: false
    };
  },
  mounted() {
    document.addEventListener('click', this.onClickOutside);
    this.dark = document.body.classList.contains('theme-dark');
  },
  beforeDestroy() {
    document.removeEventListener('click', this.onClickOutside);
  },
  methods: {
    toggleUser() {
      this.userOpen = !this.userOpen;
    },
    onClickOutside(e) {
      const el = this.$refs.userRef;
      if (el && !el.contains(e.target)) {
        this.userOpen = false;
      }
    },
    onSearch() {
      this.$emit('search', this.query);
      this.mobileOpen = false;
    },
    toggleTheme() {
      this.dark = !this.dark;
      if (this.dark) {
        document.body.classList.add('theme-dark');
      } else {
        document.body.classList.remove('theme-dark');
      }
      this.$emit('theme-change', this.dark);
    },
    signOut() {
      this.$emit('signout');
      this.userOpen = false;
    }
  }
};
</script>

<style scoped>
.app-header {
  background: var(--bs-body-bg, #fff);
  position: sticky;
  top: 0;
  z-index: 1030;
  border-bottom: 1px solid rgba(0,0,0,0.04);
}

/* brand */
.brand-logo { object-fit: contain; border-radius: 4px; }
.brand span { letter-spacing: 0.2px; }

/* mobile nav */
.mobile-nav {
  background: var(--bs-body-bg, #fff);
}

/* small touches */
.dropdown-menu {
  border-radius: 0.5rem;
}

/* dark theme helpers */
body.theme-dark {
  --bs-body-bg: #0f1720;
  --bs-body-color: #e6eef8;
}
body.theme-dark .app-header {
  background: #0b1220;
  color: #e6eef8;
}
body.theme-dark .nav-link,
body.theme-dark .text-muted {
  color: rgba(230,238,248,0.8) !important;
}
body.theme-dark .dropdown-menu {
  background: #0b1220;
  color: #e6eef8;
  border-color: rgba(255,255,255,0.05);
}

/* adjust avatar button */
.btn-light img { object-fit: cover; }

/* responsive tweaks */
@media (max-width: 767.98px) {
  .brand span { font-size: 1rem; }
}
</style>