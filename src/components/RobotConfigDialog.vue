<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Setting, InfoFilled } from '@element-plus/icons-vue';
import { getAiConfigService, updateAiConfigService } from '@/api/ai';
import { useUserInfoStore } from '@/store/userInfo';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  robotId: {
    type: Number,
    required: true
  },
  isOwner: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'close']);

const userInfoStore = useUserInfoStore();
const loading = ref(false);
const configForm = ref({
  systemPrompt: '',
  model: 'deepseek-v3',
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1.0,
  presencePenalty: 0.0,
  seed: 1234,
  dailyMessageLimit: 100,
  dailyMessageCount: 0,
  lastResetDate: null,
  totalMessages: 0,
  totalTokensUsed: 0,
  lastUsedAt: null
});

// 可用的 AI 模型列表
const modelOptions = [
  { label: 'DeepSeek V3', value: 'deepseek-v3' },
  { label: 'DeepSeek R1', value: 'deepseek-r1' },
  { label: 'QWQ Plus', value: 'qwq-plus' },
  { label: 'Qwen Max 2025', value: 'qwen-max-2025-01-25' }
];

// 对话框可见性
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// 加载配置
const loadConfig = async () => {
  if (!props.robotId) return;
  
  loading.value = true;
  try {
    const config = await getAiConfigService({ robotId: props.robotId });
    if (config) {
      configForm.value = {
        ...configForm.value,
        ...config
      };
    }
  } catch (error) {
    console.error('加载 AI 配置失败:', error);
    ElMessage.error('加载配置失败');
  } finally {
    loading.value = false;
  }
};

// 保存配置
const saveConfig = async () => {
  if (!props.isOwner) {
    ElMessage.warning('您没有权限修改此配置');
    return;
  }
  
  loading.value = true;
  try {
    await updateAiConfigService({
      robotId: props.robotId,
      systemPrompt: configForm.value.systemPrompt,
      model: configForm.value.model,
      temperature: configForm.value.temperature,
      topP: configForm.value.topP,
      presencePenalty: configForm.value.presencePenalty,
      seed: configForm.value.seed
    });
    
    ElMessage.success('配置保存成功');
    dialogVisible.value = false;
  } catch (error) {
    console.error('保存 AI 配置失败:', error);
    ElMessage.error('保存配置失败');
  } finally {
    loading.value = false;
  }
};

// 重置为默认值
const resetToDefault = () => {
  configForm.value = {
    ...configForm.value,
    systemPrompt: '',
    model: 'deepseek-v3',
    temperature: 0.7,
    topP: 1.0,
    presencePenalty: 0.0,
    seed: 1234
  };
};

// 监听对话框打开
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    loadConfig();
  }
});

// 格式化日期
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('zh-CN');
};

// 格式化日期时间
const formatDateTime = (datetime) => {
  if (!datetime) return '-';
  return new Date(datetime).toLocaleString('zh-CN');
};

// 计算使用率
const usageRate = computed(() => {
  if (!configForm.value.dailyMessageLimit) return 0;
  return Math.round((configForm.value.dailyMessageCount / configForm.value.dailyMessageLimit) * 100);
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isOwner ? 'AI 助手配置' : 'AI 助手信息'"
    width="600px"
    :close-on-click-modal="false"
    :append-to-body="true"
    destroy-on-close
    @close="emit('close')"
  >
    <div v-loading="loading" class="robot-config-content">
      <!-- 使用统计 -->
      <div class="usage-section">
        <div class="usage-header">
          <el-icon><InfoFilled /></el-icon>
          <span>使用统计</span>
        </div>
        <div class="usage-stats">
          <div class="stat-item">
            <div class="stat-label">今日已用</div>
            <div class="stat-value">
              {{ configForm.dailyMessageCount }} / {{ configForm.dailyMessageLimit }}
            </div>
            <el-progress 
              :percentage="usageRate" 
              :color="usageRate > 80 ? '#F56C6C' : '#409EFF'"
              :show-text="false"
            />
          </div>
          <div class="stat-item">
            <div class="stat-label">累计消息</div>
            <div class="stat-value">{{ configForm.totalMessages }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">累计 Token</div>
            <div class="stat-value">{{ configForm.totalTokensUsed }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">最后使用</div>
            <div class="stat-value small">{{ formatDateTime(configForm.lastUsedAt) }}</div>
          </div>
        </div>
      </div>

      <!-- 增值服务提示 -->
      <div class="service-tip-section">
        <div class="service-tip-icon">💎</div>
        <div class="service-tip-content">
          <div class="service-tip-title">需要增值服务？</div>
          <div class="service-tip-desc">如需提升额度、解锁更多功能或技术支持</div>
          <div class="service-tip-contact">请添加并联系：<strong>luf-23</strong></div>
        </div>
      </div>

      <!-- 配置表单 -->
      <el-form :model="configForm" label-position="top" class="config-form">
        <div class="form-section-header">
          <el-icon><Setting /></el-icon>
          <span>模型配置</span>
        </div>

        <el-form-item label="系统提示词">
          <el-input
            v-model="configForm.systemPrompt"
            type="textarea"
            :rows="4"
            placeholder="定义 AI 的角色和行为规则，例：我说什么你说什么"
            :disabled="!isOwner"
            maxlength="500"
            show-word-limit
          />
          <div class="form-tip">
            <el-icon><InfoFilled /></el-icon>
            系统提示词用于定义 AI 的角色、性格和回答风格
          </div>
        </el-form-item>

        <el-form-item label="AI 模型">
          <el-select 
            v-model="configForm.model" 
            placeholder="选择模型"
            :disabled="!isOwner"
            style="width: 100%"
          >
            <el-option
              v-for="item in modelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="温度 (Temperature)">
          <div class="slider-container">
            <el-slider
              v-model="configForm.temperature"
              :min="0"
              :max="2"
              :step="0.01"
              :disabled="!isOwner"
              class="config-slider"
            />
            <el-input-number
              v-model="configForm.temperature"
              :min="0"
              :max="2"
              :step="0.01"
              :precision="2"
              :disabled="!isOwner"
              :controls="false"
              class="slider-input"
            />
          </div>
          <div class="form-tip">
            <el-icon><InfoFilled /></el-icon>
            控制回答的随机性，值越高越有创造性，值越低越确定
          </div>
        </el-form-item>

        <el-form-item label="Top P">
          <div class="slider-container">
            <el-slider
              v-model="configForm.topP"
              :min="0"
              :max="1"
              :step="0.01"
              :disabled="!isOwner"
              class="config-slider"
            />
            <el-input-number
              v-model="configForm.topP"
              :min="0"
              :max="1"
              :step="0.01"
              :precision="2"
              :disabled="!isOwner"
              :controls="false"
              class="slider-input"
            />
          </div>
          <div class="form-tip">
            <el-icon><InfoFilled /></el-icon>
            核采样参数，控制输出的多样性
          </div>
        </el-form-item>

        <el-form-item label="存在惩罚 (Presence Penalty)">
          <div class="slider-container">
            <el-slider
              v-model="configForm.presencePenalty"
              :min="-2"
              :max="2"
              :step="0.01"
              :disabled="!isOwner"
              class="config-slider"
            />
            <el-input-number
              v-model="configForm.presencePenalty"
              :min="-2"
              :max="2"
              :step="0.01"
              :precision="2"
              :disabled="!isOwner"
              :controls="false"
              class="slider-input"
            />
          </div>
          <div class="form-tip">
            <el-icon><InfoFilled /></el-icon>
            降低重复内容的倾向，正值使模型更倾向于谈论新话题
          </div>
        </el-form-item>

        <el-form-item label="随机种子 (Seed)">
          <el-input-number
            v-model="configForm.seed"
            :min="0"
            :max="9999"
            :disabled="!isOwner"
            :controls="true"
            style="width: 100%"
          />
          <div class="form-tip">
            <el-icon><InfoFilled /></el-icon>
            设置相同的种子和参数可以获得相同的输出
          </div>
        </el-form-item>

        <el-form-item label="最大 Token 数 (Max Tokens)">
          <el-input-number
            v-model="configForm.maxTokens"
            disabled
            :controls="false"
            style="width: 100%"
          />
          <div class="form-tip">
            <el-icon><InfoFilled /></el-icon>
            单次回复的最大 token 数（不可修改）
          </div>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button class="cancel-btn" @click="dialogVisible = false">
          {{ isOwner ? '取消' : '关闭' }}
        </el-button>
        <el-button v-if="isOwner" class="reset-btn" @click="resetToDefault">
          恢复默认
        </el-button>
        <el-button v-if="isOwner" type="primary" @click="saveConfig" :loading="loading">
          保存配置
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.robot-config-content {
  max-height: 65vh;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

/* 使用统计区域 */
.usage-section {
  background: linear-gradient(to bottom, var(--el-color-primary-light-9), var(--el-bg-color));
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.usage-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 16px;
  color: var(--el-text-color-primary);
}

.usage-header .el-icon {
  font-size: 18px;
  color: var(--el-color-primary);
}

.usage-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  word-break: break-word;
}

.stat-value.small {
  font-size: 14px;
  font-weight: normal;
}

/* 增值服务提示区域 */
.service-tip-section {
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(56, 189, 248, 0.08);
  transition: all 0.3s ease;
}

.service-tip-section:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(56, 189, 248, 0.15);
}

.service-tip-icon {
  font-size: 32px;
  flex-shrink: 0;
  animation: bounce-gentle 2s infinite ease-in-out;
}

@keyframes bounce-gentle {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

.service-tip-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.service-tip-title {
  font-size: 15px;
  font-weight: 600;
  color: #0c4a6e;
  margin-bottom: 2px;
}

.service-tip-desc {
  font-size: 13px;
  color: #0369a1;
  line-height: 1.5;
}

.service-tip-contact {
  font-size: 13px;
  color: #0369a1;
  margin-top: 4px;
}

.service-tip-contact strong {
  color: #0284c7;
  font-weight: 600;
  font-size: 14px;
  padding: 2px 6px;
  background-color: rgba(186, 230, 253, 0.5);
  border-radius: 4px;
  margin-left: 2px;
}

/* 配置表单 */
.config-form {
  padding: 0 4px;
}

.form-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--el-border-color-light);
}

.form-section-header .el-icon {
  font-size: 18px;
  color: var(--el-color-primary);
}

.config-form :deep(.el-form-item) {
  margin-bottom: 24px;
}

.config-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-size: 14px;
  margin-bottom: 8px;
  line-height: 1.5;
}

/* 滑块容器 */
.slider-container {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.config-slider {
  flex: 1;
  min-width: 0;
  padding: 0 8px;
}

.config-slider :deep(.el-slider__runway) {
  margin: 16px 0;
}

.config-slider :deep(.el-slider__button-wrapper) {
  z-index: 1;
  touch-action: none;
}

.config-slider :deep(.el-slider__button) {
  touch-action: none;
}

.slider-input {
  width: 100px;
  flex-shrink: 0;
}

.slider-input :deep(.el-input__inner) {
  text-align: center;
}

/* 提示信息 */
.form-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  background-color: var(--el-fill-color-light);
  border-radius: 6px;
  border-left: 3px solid var(--el-color-primary-light-5);
}

.form-tip .el-icon {
  font-size: 14px;
  color: var(--el-color-primary);
  margin-top: 1px;
  flex-shrink: 0;
}

/* 底部按钮 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .robot-config-content {
    max-height: none;
  }
  
  .usage-section {
    padding: 16px;
    margin-bottom: 20px;
    border-radius: 8px;
  }
  
  .usage-header {
    font-size: 15px;
    margin-bottom: 12px;
  }
  
  .usage-stats {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .stat-value {
    font-size: 18px;
  }
  
  .service-tip-section {
    flex-direction: column;
    text-align: center;
    padding: 14px 16px;
    margin-bottom: 20px;
    border-radius: 8px;
    gap: 12px;
  }
  
  .service-tip-icon {
    font-size: 28px;
  }
  
  .service-tip-content {
    align-items: center;
    gap: 6px;
  }
  
  .service-tip-title {
    font-size: 14px;
  }
  
  .service-tip-desc {
    font-size: 12px;
  }
  
  .service-tip-contact {
    font-size: 12px;
  }
  
  .service-tip-contact strong {
    font-size: 13px;
  }
  
  .config-form {
    padding: 0;
  }
  
  .form-section-header {
    font-size: 15px;
    margin-bottom: 16px;
  }
  
  .config-form :deep(.el-form-item) {
    margin-bottom: 20px;
  }
  
  .config-form :deep(.el-form-item__label) {
    font-size: 14px;
    margin-bottom: 6px;
  }
  
  /* 滑块在移动端改为竖向布局 */
  .slider-container {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .config-slider {
    width: 100%;
    padding: 0 12px;
  }
  
  .config-slider :deep(.el-slider__runway) {
    margin: 20px 0;
  }
  
  .config-slider :deep(.el-slider__bar),
  .config-slider :deep(.el-slider__button-wrapper) {
    touch-action: pan-x;
  }
  
  .slider-input {
    width: 100%;
  }
  
  .form-tip {
    font-size: 12px;
    padding: 8px 10px;
  }
  
  /* 底部按钮移动端样式 - 隐藏取消按钮 */
  .dialog-footer {
    gap: 12px;
  }
  
  .dialog-footer .cancel-btn {
    display: none;
  }
  
  .dialog-footer .el-button {
    flex: 1;
    min-height: 44px;
  }
  
  /* 只有一个按钮时占满宽度 */
  .dialog-footer .el-button:only-child {
    width: 100%;
  }
}

/* 小屏幕设备额外优化 */
@media (max-width: 480px) {
  .usage-section {
    padding: 12px;
  }
  
  .usage-header {
    font-size: 14px;
  }
  
  .stat-label {
    font-size: 12px;
  }
  
  .stat-value {
    font-size: 16px;
  }
  
  .stat-value.small {
    font-size: 13px;
  }
  
  .service-tip-section {
    padding: 12px 14px;
    gap: 10px;
  }
  
  .service-tip-icon {
    font-size: 26px;
  }
  
  .service-tip-title {
    font-size: 13px;
  }
  
  .service-tip-desc,
  .service-tip-contact {
    font-size: 11px;
  }
  
  .service-tip-contact strong {
    font-size: 12px;
    padding: 1px 4px;
  }
  
  .form-section-header {
    font-size: 14px;
  }
  
  .config-form :deep(.el-form-item__label) {
    font-size: 13px;
  }
  
  .config-slider {
    padding: 0 16px;
  }
  
  .config-slider :deep(.el-slider__runway) {
    margin: 24px 0;
  }
  
  .form-tip {
    font-size: 11px;
    padding: 6px 8px;
  }
  
  /* 保证输入框在小屏幕上的可用性 */
  .config-form :deep(.el-input__inner),
  .config-form :deep(.el-textarea__inner),
  .config-form :deep(.el-input-number__increase),
  .config-form :deep(.el-input-number__decrease) {
    min-height: 40px;
    font-size: 14px;
  }
  
  .slider-input :deep(.el-input__inner) {
    min-height: 44px;
  }
  
  /* 按钮优化 */
  .dialog-footer .el-button {
    min-height: 48px;
    font-size: 15px;
  }
}

/* 横屏模式优化 */
@media (max-width: 768px) and (orientation: landscape) {
  .usage-stats {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .slider-container {
    flex-direction: row;
  }
  
  .slider-input {
    width: 100px;
  }
}
</style>
