import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import router from './router/index.js'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const app = createApp(App)
const pinia = createPinia()

// 配置 Pinia 持久化插件
pinia.use(piniaPluginPersistedstate)

app.use(ElementPlus);
app.use(pinia);
app.use(router);

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.mount("#app");
