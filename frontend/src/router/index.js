import Vue from 'vue'
import Router from 'vue-router'

// 页面组件（确保这些文件存在）
import BrGuides from '@/components/BrGuides.vue'
import MakeBrowserTalk from '@/components/MakeBrowserTalk.vue'
import ContentGen from '@/components/ContentGen.vue'
import BrWithAI from '@/components/BrWithAI.vue'
import RestAPIExample from '@/components/RestAPIExample.vue'
// import SeoAnalytic from '@/components/SeoAnalytic.vue'
import BrIntroduction from '@/components/BrIntroduction.vue'

Vue.use(Router)

const routes = [
    { path: '/', redirect: '/br-guides' },
    { path: '/br-introduction', name: 'BrIntroduction', component: BrIntroduction },
    { path: '/br-guides', name: 'BrGuides', component: BrGuides },
    { path: '/make-browser-talk', name: 'MakeBrowserTalk', component: MakeBrowserTalk },
    { path: '/content-generation', name: 'ContentGen', component: ContentGen },
    { path: '/br-withai', name: 'BrWithAI', component: BrWithAI },
    { path: '/rest-apiexample', name: 'RestAPIExample', component: RestAPIExample },
    // { path: '/seo-analytic', name: 'SeoAnalytic', component: SeoAnalytic },

    // fallback
    { path: '*', redirect: '/' }
]

export default new Router({
    mode: 'hash', // 开发用 hash 模式最方便；若想用 history 请改为 'history' 并配置后端回退
    routes
})