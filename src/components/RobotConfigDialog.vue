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
    width="680px"
    :close-on-click-modal="false"
    @close="emit('close')"
  >
    <div v-loading="loading" class="robot-config-content">
      <!-- 使用统计 -->
      <el-card class="usage-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <el-icon><InfoFilled /></el-icon>
            <span>使用统计</span>
          </div>
        </template>
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
      </el-card>

      <!-- 配置表单 -->
      <el-form :model="configForm" label-width="120px" class="config-form">
        <el-divider content-position="left">
          <el-icon><Setting /></el-icon>
          <span style="margin-left: 8px;">模型配置</span>
        </el-divider>

        <el-form-item label="系统提示词">
          <el-input
            v-model="configForm.systemPrompt"
            type="textarea"
            :rows="4"
            placeholder="定义 AI 的角色和行为规则"
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
          <div class="slider-wrapper">
            <el-slider
              v-model="configForm.temperature"
              :min="0"
              :max="2"
              :step="0.01"
              :disabled="!isOwner"
              show-input
              :show-input-controls="false"
            />
          </div>
          <div class="form-tip">
            <el-icon><InfoFilled /></el-icon>
            控制回答的随机性，值越高越有创造性，值越低越确定
          </div>
        </el-form-item>

        <el-form-item label="Top P">
          <div class="slider-wrapper">
            <el-slider
              v-model="configForm.topP"
              :min="0"
              :max="1"
              :step="0.01"
              :disabled="!isOwner"
              show-input
              :show-input-controls="false"
            />
          </div>
          <div class="form-tip">
            <el-icon><InfoFilled /></el-icon>
            核采样参数，控制输出的多样性
          </div>
        </el-form-item>

        <el-form-item label="存在惩罚">
          <div class="slider-wrapper">
            <el-slider
              v-model="configForm.presencePenalty"
              :min="-2"
              :max="2"
              :step="0.01"
              :disabled="!isOwner"
              show-input
              :show-input-controls="false"
            />
          </div>
          <div class="form-tip">
            <el-icon><InfoFilled /></el-icon>
            降低重复内容的倾向，正值使模型更倾向于谈论新话题
          </div>
        </el-form-item>

        <el-form-item label="随机种子">
          <el-input-number
            v-model="configForm.seed"
            :min="0"
            :max="9999"
            :disabled="!isOwner"
            style="width: 100%"
          />
          <div class="form-tip">
            <el-icon><InfoFilled /></el-icon>
            设置相同的种子和参数可以获得相同的输出
          </div>
        </el-form-item>

        <el-form-item label="最大 Token 数">
          <el-input-number
            v-model="configForm.maxTokens"
            disabled
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
        <el-button @click="dialogVisible = false">
          {{ isOwner ? '取消' : '关闭' }}
        </el-button>
        <el-button v-if="isOwner" @click="resetToDefault">
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
  max-height: 70vh;
  overflow-y: auto;
}

.usage-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.usage-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-value.small {
  font-size: 14px;
  font-weight: normal;
}

.config-form {
  margin-top: 16px;
}

.slider-wrapper {
  width: 100%;
}

.form-tip {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.form-tip .el-icon {
  font-size: 14px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .usage-stats {
    grid-template-columns: 1fr;
  }
  
  .stat-value {
    font-size: 18px;
  }
}
</style>
