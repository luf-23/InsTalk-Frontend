import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import router from './router/index.js'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// 全局设置被动事件监听器，提高滚动性能
// 参考：https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener#%E4%BD%BF%E7%94%A8_passive_%E6%94%B9%E5%96%84%E6%BB%9A%E5%8A%A8%E6%80%A7%E8%83%BD
if (typeof window !== 'undefined') {
  const passiveSupported = (() => {
    let supported = false;
    try {
      const options = {
        get passive() {
          supported = true;
          return false;
        }
      };
      window.addEventListener('test', null, options);
      window.removeEventListener('test', null, options);
    } catch (err) {
      supported = false;
    }
    return supported;
  })();

  if (passiveSupported) {
    const addEventListenerOriginal = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const usesListenerOptions = typeof options === 'object' && options !== null;
      const useCapture = usesListenerOptions ? options.capture : options;

      options = usesListenerOptions ? options : {};
      options.passive = options.passive !== undefined ? options.passive : 
        (type === 'wheel' || type === 'mousewheel' || type === 'touchstart' || type === 'touchmove');
      options.capture = useCapture !== undefined ? useCapture : false;

      addEventListenerOriginal.call(this, type, listener, options);
    };
  }
}

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
