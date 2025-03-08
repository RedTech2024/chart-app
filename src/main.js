import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// 导入Element Plus样式
import 'element-plus/dist/index.css'
// 导入自定义按钮样式
import './assets/button-styles.css'
// 导入Element Plus图标
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const app = createApp(App)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')
