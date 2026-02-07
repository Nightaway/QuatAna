<template>
  <div class="backtest-controls">
    <div class="section">
      <h3>数据源</h3>
      <div class="data-source-toggle">
        <button
          :class="{ active: dataSource === 'default' }"
          @click="dataSource = 'default'"
        >
          默认数据
        </button>
        <button
          :class="{ active: dataSource === 'upload' }"
          @click="dataSource = 'upload'"
        >
          上传数据
        </button>
      </div>

      <div v-if="dataSource === 'default'" class="default-data-selector">
        <label>选择数据周期</label>
        <select v-model="selectedDataSource" class="data-select">
          <option v-for="ds in dataSourceList" :key="ds.key" :value="ds.key">
            {{ ds.label }}
          </option>
        </select>
        <p class="data-desc">{{ currentDataSourceDesc }}</p>
      </div>

      <div v-if="dataSource === 'upload'" class="upload-section">
        <DataUploader
          @data-loaded="handleDataLoaded"
          @data-cleared="handleDataCleared"
        />
      </div>
    </div>

    <div class="section">
      <h3>策略选择</h3>
      <select v-model="selectedStrategy" class="strategy-select">
        <option v-for="s in strategyList" :key="s.key" :value="s.key">
          {{ s.name }}
        </option>
      </select>
      <p class="strategy-desc">{{ currentStrategyDesc }}</p>
    </div>

    <div class="section">
      <h3>策略参数</h3>
      <div class="params-grid">
        <div
          v-for="param in currentParamConfig"
          :key="param.key"
          class="param-item"
        >
          <label>{{ param.label }}</label>
          <template v-if="param.type === 'select'">
            <select v-model="strategyParams[param.key]">
              <option
                v-for="(opt, idx) in param.options"
                :key="opt"
                :value="opt"
              >
                {{ param.labels ? param.labels[idx] : opt }}
              </option>
            </select>
          </template>
          <template v-else>
            <input
              v-model.number="strategyParams[param.key]"
              type="number"
              :min="param.min"
              :max="param.max"
              :step="param.step || 1"
            />
          </template>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>回测配置</h3>
      <div class="params-grid">
        <div class="param-item">
          <label>初始资金</label>
          <input v-model.number="config.initialCapital" type="number" min="1000" step="1000" />
        </div>
        <div class="param-item">
          <label>仓位比例</label>
          <input v-model.number="config.positionSize" type="number" min="0.1" max="1" step="0.1" />
        </div>
        <div class="param-item">
          <label>手续费率 (%)</label>
          <input v-model.number="commissionPercent" type="number" min="0" max="1" step="0.01" />
        </div>
        <div class="param-item">
          <label>滑点 (%)</label>
          <input v-model.number="slippagePercent" type="number" min="0" max="1" step="0.01" />
        </div>
      </div>

      <div class="short-toggle">
        <label class="toggle-label">
          <input v-model="config.allowShort" type="checkbox" />
          <span class="toggle-text">允许做空</span>
        </label>
      </div>
    </div>

    <button
      class="run-btn"
      :disabled="isRunning || !canRun"
      @click="runBacktest"
    >
      {{ isRunning ? '运行中...' : '运行回测' }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { getStrategyList, getStrategyParams } from '~/utils/backtestEngine'
import { getDataSourceList, DATA_SOURCES } from '~/utils/dataLoader'

const emit = defineEmits(['run', 'data-source-change'])

const props = defineProps({
  isRunning: {
    type: Boolean,
    default: false
  },
  hasData: {
    type: Boolean,
    default: false
  }
})

// 数据源
const dataSource = ref('default')
const selectedDataSource = ref('daily')
const dataSourceList = getDataSourceList()
const uploadedData = ref(null)

// 当前数据源描述
const currentDataSourceDesc = computed(() => {
  const ds = DATA_SOURCES[selectedDataSource.value]
  return ds?.description || ''
})

// 策略
const strategyList = getStrategyList()
const selectedStrategy = ref('ma')
const strategyParams = ref({})

// 回测配置
const config = ref({
  initialCapital: 100000,
  positionSize: 1,
  commission: 0.001,
  slippage: 0.0005,
  allowShort: false
})

// 手续费和滑点的百分比显示
const commissionPercent = computed({
  get: () => config.value.commission * 100,
  set: (val) => { config.value.commission = val / 100 }
})

const slippagePercent = computed({
  get: () => config.value.slippage * 100,
  set: (val) => { config.value.slippage = val / 100 }
})

// 当前策略信息
const currentStrategy = computed(() => {
  return strategyList.find(s => s.key === selectedStrategy.value)
})

const currentStrategyDesc = computed(() => {
  return currentStrategy.value?.description || ''
})

const currentParamConfig = computed(() => {
  return currentStrategy.value?.paramConfig || []
})

// 是否可以运行
const canRun = computed(() => {
  if (dataSource.value === 'upload') {
    return uploadedData.value !== null
  }
  return true
})

// 监听策略变化，重置参数
watch(selectedStrategy, (newVal) => {
  const params = getStrategyParams(newVal)
  if (params) {
    strategyParams.value = { ...params.defaultParams }
  }
  // 布林带极值回归策略需要做空，自动开启
  config.value.allowShort = newVal === 'bollExtreme'
}, { immediate: true })

// 监听数据源变化
watch(dataSource, (newVal) => {
  emit('data-source-change', {
    source: newVal,
    data: newVal === 'upload' ? uploadedData.value : null,
    dataSourceKey: newVal === 'default' ? selectedDataSource.value : null
  })
})

// 监听默认数据源选择变化
watch(selectedDataSource, (newVal) => {
  if (dataSource.value === 'default') {
    emit('data-source-change', {
      source: 'default',
      data: null,
      dataSourceKey: newVal
    })
  }
})

function handleDataLoaded(data) {
  uploadedData.value = data
  emit('data-source-change', {
    source: 'upload',
    data: data
  })
}

function handleDataCleared() {
  uploadedData.value = null
  emit('data-source-change', {
    source: 'upload',
    data: null
  })
}

function runBacktest() {
  emit('run', {
    strategy: selectedStrategy.value,
    strategyParams: { ...strategyParams.value },
    config: { ...config.value },
    dataSource: dataSource.value,
    uploadedData: uploadedData.value
  })
}
</script>

<style scoped>
.backtest-controls {
  padding: 20px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.section {
  margin-bottom: 24px;
}

.section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.data-source-toggle {
  display: flex;
  gap: 8px;
}

.data-source-toggle button {
  flex: 1;
  padding: 10px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.data-source-toggle button.active {
  background: #333;
  border-color: #333;
  color: #fff;
}

.data-source-toggle button:hover:not(.active) {
  background: #eee;
}

.upload-section {
  margin-top: 15px;
}

.default-data-selector {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.default-data-selector label {
  font-size: 12px;
  color: #888;
}

.data-select {
  width: 100%;
  padding: 10px 12px;
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  color: #333;
  font-size: 14px;
  cursor: pointer;
}

.data-select:focus {
  outline: none;
  border-color: #666;
}

.data-desc {
  margin: 0;
  font-size: 12px;
  color: #888;
}

.strategy-select {
  width: 100%;
  padding: 12px;
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  color: #333;
  font-size: 14px;
  cursor: pointer;
}

.strategy-select:focus {
  outline: none;
  border-color: #666;
}

.strategy-desc {
  margin: 10px 0 0 0;
  font-size: 13px;
  color: #888;
  line-height: 1.5;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.param-item label {
  font-size: 12px;
  color: #888;
}

.param-item input,
.param-item select {
  padding: 10px;
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  color: #333;
  font-size: 14px;
}

.param-item input:focus,
.param-item select:focus {
  outline: none;
  border-color: #666;
}

.short-toggle {
  margin-top: 15px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.toggle-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #333;
}

.toggle-text {
  font-size: 14px;
  color: #555;
}

.run-btn {
  width: 100%;
  padding: 14px;
  background: #333;
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.run-btn:hover:not(:disabled) {
  background: #555;
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.run-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
