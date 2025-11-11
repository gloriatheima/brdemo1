// const { defineConfig } = require('@vue/cli-service')
// module.exports = defineConfig({
//   transpileDependencies: true
// })


const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      // 转发这些路径到本地后端 wrangler dev（127.0.0.1:8787）
      '^/(content|snapshot|screenshot|pdf|scrape|json|links|markdown|status)$': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        secure: false,
        logLevel: 'debug', // 可在控制台看到代理日志，调试时有用
        // 保留路径不做重写，直接 /content -> http://127.0.0.1:8787/content
      },
      '^/talk': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
      '^/audio': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        secure: false,
        ws: false,
      },

      // 新增：把前端对 /seo 的请求转发到本地 worker（SeoAnalytic.vue 使用 fetch('/seo')）
      // 说明：使用 '^/seo' 会匹配 /seo 和 /seo/anything；若只需精确匹配 /seo，可改为 '^/seo$'
      '^/seo': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        secure: false,
        logLevel: 'debug', // 便于在控制台查看代理是否生效
      }
    }
  }
});