<template>
  <div class="backtest-page">
    <header class="page-header">
      <NuxtLink to="/" class="back-btn">
        ← 返回首页
      </NuxtLink>
      <h1>策略回测</h1>
      <p class="subtitle">使用历史数据测试交易策略</p>
    </header>

    <div class="main-content">
      <aside class="sidebar">
        <BacktestControls
          :is-running="isRunning"
          :has-data="klineData.length > 0"
          @run="handleRunBacktest"
          @data-source-change="handleDataSourceChange"
        />
      </aside>

      <main class="content-area">
        <div class="chart-section">
          <h2>K线图表</h2>
          <ClientOnly>
            <BacktestChart
              ref="chartRef"
              :data="klineData"
              :trades="backtestResult?.trades || []"
              :strategy="currentStrategy"
              :period="currentPeriod"
            />
          </ClientOnly>
        </div>

        <div v-if="backtestResult && metrics" class="results-section">
          <h2>回测结果</h2>
          <BacktestResults
            :metrics="metrics"
            :trades="backtestResult.trades"
            :initial-capital="backtestResult.initialCapital"
          />
        </div>

        <div v-else-if="!isRunning" class="empty-state">
          <div class="empty-icon">📊</div>
          <p>配置策略参数后点击"运行回测"查看结果</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { loadDefaultData, DATA_SOURCES } from '~/utils/dataLoader'
import { runBacktest } from '~/utils/backtestEngine'
import { calculateMetrics } from '~/utils/performanceMetrics'

const chartRef = ref(null)
const klineData = ref([])
const backtestResult = ref(null)
const metrics = ref(null)
const isRunning = ref(false)
const dataSource = ref('default')
const uploadedData = ref(null)
const currentStrategy = ref(null)
const currentPeriod = ref({ span: 1, type: 'day' })

// 加载默认数据
async function loadData(sourceKey = 'daily') {
  try {
    const data = await loadDefaultData(sourceKey)
    klineData.value = data
    // 更新周期信息
    const source = DATA_SOURCES[sourceKey]
    if (source) {
      if (sourceKey === '15m') {
        currentPeriod.value = { span: 15, type: 'minute' }
      } else {
        currentPeriod.value = { span: 1, type: 'day' }
      }
    }
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

// 处理数据源变化
function handleDataSourceChange({ source, data, dataSourceKey }) {
  dataSource.value = source
  if (source === 'upload' && data) {
    uploadedData.value = data
    klineData.value = data
    // 上传数据默认使用日线周期
    currentPeriod.value = { span: 1, type: 'day' }
  } else if (source === 'default') {
    uploadedData.value = null
    loadData(dataSourceKey || 'daily')
  }
}

// 运行回测
async function handleRunBacktest({ strategy, strategyParams, config }) {
  if (klineData.value.length === 0) {
    console.error('没有可用数据')
    return
  }

  isRunning.value = true
  backtestResult.value = null
  metrics.value = null

  // 更新当前策略信息
  currentStrategy.value = {
    name: strategy,
    params: strategyParams
  }

  try {
    // 使用 setTimeout 让 UI 有机会更新
    await new Promise(resolve => setTimeout(resolve, 50))

    const result = runBacktest(klineData.value, strategy, strategyParams, config)
    backtestResult.value = result
    metrics.value = calculateMetrics(result)

    // 刷新图表
    if (chartRef.value) {
      chartRef.value.refresh()
    }
  } catch (error) {
    console.error('回测失败:', error)
  } finally {
    isRunning.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.backtest-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 50%, #d5dbe3 100%);
  padding: 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
  position: relative;
}

.back-btn {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
  text-decoration: none;
  font-size: 14px;
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.back-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #333;
}

.page-header h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  color: #333;
}

.subtitle {
  margin: 10px 0 0 0;
  color: #888;
  font-size: 16px;
}

.main-content {
  display: flex;
  gap: 25px;
  max-width: 1800px;
  margin: 0 auto;
}

.sidebar {
  width: 350px;
  flex-shrink: 0;
}

.content-area {
  flex: 1;
  min-width: 0;
}

.chart-section,
.results-section {
  margin-bottom: 25px;
}

.chart-section h2,
.results-section h2 {
  margin: 0 0 15px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-state p {
  color: #888;
  font-size: 16px;
  margin: 0;
}

@media (max-width: 1200px) {
  .main-content {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
  }
}
</style>
