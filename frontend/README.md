# brdemo1

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

```markdown
# BRDEMO1 Monorepo (frontend + backend)

本仓库把前端 Vue 应用放在 frontend/，后端 Cloudflare Worker 放在 backend/。

本地开发
1) 安装依赖
  - 前端：
    cd frontend
    npm install
  - 根（用于并行启动，可选）：
    npm install

2) 启动后端 Worker（终端 A）：
  cd backend
  npx wrangler dev --local --port 8787

3) 启动前端开发服务器（终端 B）：
  cd frontend
  npm run serve

4) 打开浏览器访问前端页面并测试 ContentGen 组件（fetch 请求到 /screenshot 等会被 proxy 转发到本地 worker）

部署（一次性推）
1) 设置后端 secret 并发布：
  cd backend
  npx wrangler secret put BR_API_TOKEN   # 粘入你的 BR token
  编辑 wrangler.toml 填写 account_id
  npx wrangler publish

2) 部署前端（Cloudflare Pages 推荐）：
  - 在 Pages 创建项目并连接到本仓库，subdirectory = frontend
  - Build command: npm run build
  - Build output directory: dist
  - 在 Pages 环境变量中设置前端的 API 地址（如果你的前端使用绝对地址）
```
