// 动态背景交互控制器
export class DynamicBackground {
  constructor() {
    this.particlesCount = 20;
    this.lightDotsCount = 15;
    this.particles = [];
    this.lightDots = [];
    this.cursorGlow = null;
    this.container = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.init();
  }

  init() {
    this.createContainer();
    this.createParticles();
    this.createWaves();
    this.createGridOverlay();
    this.createLightDots();
    this.createCursorGlow();
    this.bindEvents();
  }

  createContainer() {
    // 如果已经存在背景容器，先移除
    const existingContainer = document.querySelector('.dynamic-background');
    if (existingContainer) {
      existingContainer.remove();
    }

    this.container = document.createElement('div');
    this.container.className = 'dynamic-background';
    document.body.appendChild(this.container);
  }

  createParticles() {
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles-container';
    
    for (let i = 0; i < this.particlesCount; i++) {
      const particle = document.createElement('div');
      const sizes = ['small', 'medium', 'large'];
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      
      particle.className = `particle ${size}`;
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 15 + 's';
      particle.style.animationDuration = (15 + Math.random() * 10) + 's';
      
      particlesContainer.appendChild(particle);
      this.particles.push(particle);
    }
    
    this.container.appendChild(particlesContainer);
  }

  createWaves() {
    const waveContainer = document.createElement('div');
    waveContainer.className = 'wave-container';
    
    for (let i = 0; i < 3; i++) {
      const wave = document.createElement('div');
      wave.className = 'wave';
      waveContainer.appendChild(wave);
    }
    
    this.container.appendChild(waveContainer);
  }

  createGridOverlay() {
    const gridOverlay = document.createElement('div');
    gridOverlay.className = 'grid-overlay';
    this.container.appendChild(gridOverlay);
  }

  createLightDots() {
    const lightDotsContainer = document.createElement('div');
    lightDotsContainer.className = 'light-dots';
    
    for (let i = 0; i < this.lightDotsCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'light-dot';
      dot.style.left = Math.random() * 100 + '%';
      dot.style.top = Math.random() * 100 + '%';
      dot.style.animationDelay = Math.random() * 3 + 's';
      
      lightDotsContainer.appendChild(dot);
      this.lightDots.push(dot);
    }
    
    this.container.appendChild(lightDotsContainer);
  }

  createCursorGlow() {
    this.cursorGlow = document.createElement('div');
    this.cursorGlow.className = 'cursor-glow';
    document.body.appendChild(this.cursorGlow);
  }

  bindEvents() {
    // 鼠标移动事件
    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.updateCursorGlow();
    });

    // 窗口大小改变事件
    window.addEventListener('resize', () => {
      this.repositionElements();
    });

    // 页面可见性改变事件（优化性能）
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAnimations();
      } else {
        this.resumeAnimations();
      }
    });
  }

  updateCursorGlow() {
    if (this.cursorGlow) {
      this.cursorGlow.style.left = this.mouseX + 'px';
      this.cursorGlow.style.top = this.mouseY + 'px';
    }
  }

  repositionElements() {
    // 重新定位光点
    this.lightDots.forEach(dot => {
      dot.style.left = Math.random() * 100 + '%';
      dot.style.top = Math.random() * 100 + '%';
    });
  }

  pauseAnimations() {
    if (this.container) {
      this.container.style.animationPlayState = 'paused';
      this.particles.forEach(particle => {
        particle.style.animationPlayState = 'paused';
      });
      this.lightDots.forEach(dot => {
        dot.style.animationPlayState = 'paused';
      });
    }
  }

  resumeAnimations() {
    if (this.container) {
      this.container.style.animationPlayState = 'running';
      this.particles.forEach(particle => {
        particle.style.animationPlayState = 'running';
      });
      this.lightDots.forEach(dot => {
        dot.style.animationPlayState = 'running';
      });
    }
  }

  // 添加新粒子
  addParticle() {
    const particle = document.createElement('div');
    const sizes = ['small', 'medium', 'large'];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    
    particle.className = `particle ${size}`;
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = '0s';
    particle.style.animationDuration = (15 + Math.random() * 10) + 's';
    
    const particlesContainer = this.container.querySelector('.particles-container');
    if (particlesContainer) {
      particlesContainer.appendChild(particle);
      this.particles.push(particle);
    }
  }

  // 清理资源
  destroy() {
    if (this.container) {
      this.container.remove();
    }
    if (this.cursorGlow) {
      this.cursorGlow.remove();
    }
    
    // 移除事件监听器
    document.removeEventListener('mousemove', this.updateCursorGlow);
    window.removeEventListener('resize', this.repositionElements);
    document.removeEventListener('visibilitychange', this.pauseAnimations);
  }

  // 更新背景颜色主题
  setTheme(primaryColor, secondaryColor) {
    if (this.container) {
      this.container.style.background = `linear-gradient(135deg, 
        rgba(240, 248, 255, 0.9) 0%, 
        rgba(230, 240, 250, 0.85) 25%, 
        ${primaryColor} 50%, 
        rgba(210, 230, 250, 0.85) 75%, 
        ${secondaryColor} 100%)`;
    }
  }

  // 调整粒子密度
  setParticleCount(count) {
    const particlesContainer = this.container.querySelector('.particles-container');
    if (!particlesContainer) return;

    // 清除现有粒子
    this.particles.forEach(particle => particle.remove());
    this.particles = [];

    // 创建新粒子
    this.particlesCount = count;
    for (let i = 0; i < this.particlesCount; i++) {
      const particle = document.createElement('div');
      const sizes = ['small', 'medium', 'large'];
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      
      particle.className = `particle ${size}`;
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 15 + 's';
      particle.style.animationDuration = (15 + Math.random() * 10) + 's';
      
      particlesContainer.appendChild(particle);
      this.particles.push(particle);
    }
  }
}

// 自动初始化背景（可选）
let backgroundInstance = null;

export const initDynamicBackground = () => {
  if (!backgroundInstance) {
    backgroundInstance = new DynamicBackground();
  }
  return backgroundInstance;
};

export const destroyDynamicBackground = () => {
  if (backgroundInstance) {
    backgroundInstance.destroy();
    backgroundInstance = null;
  }
};

// 导出实例以供外部使用
export { backgroundInstance };