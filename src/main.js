import Vue from 'vue'
import App from './App.vue'
import BrHeader from './components/BrHeader.vue'
// Bootstrap + BootstrapVue CSS
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

// 引入并注册插件
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue'
Vue.use(BootstrapVue)
Vue.use(IconsPlugin)

Vue.config.productionTip = false

Vue.component("BrHeader", BrHeader)

new Vue({
  // el:'app',
  render: h => h(App),
}).$mount('#app')
