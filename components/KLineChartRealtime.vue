<script setup>
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import { init, dispose } from 'klinecharts'
import { createOKXDataLoader } from '../utils/okxDataService'
import { getOKXWebSocketManager } from '../utils/okxWebSocket'

const chartRef = ref(null)
let chart = null
let wsManager = null

// 响应式状态
const status = ref({
  loading: true,
  connected: false,
  dataLoaded: false,
  error: null
})

const stats = ref({
  barCount: 0,
  lastUpdate: null
})

onMounted(async () => {
  await nextTick()
  
  try {
    // 初始化图表
    chart = init('kline-chart-realtime')
    
    if (!chart) {
      throw new Error('图表初始化失败：无法找到 DOM 元素')
    }
    
    console.log('✅ 图表初始化成功')
    
    // 创建 WebSocket 管理器
    wsManager = getOKXWebSocketManager()
    
    // 设置交易对信息
    chart.setSymbol({
      ticker: 'ETH-USDT',
      exchange: 'OKX'
    })
    
    // 设置周期（日线）
    chart.setPeriod({
      span: 1,
      type: 'day'
    })
    
    // ⭐ 关键：设置 OKX 数据加载器（集成实时数据）
    chart.setDataLoader(createOKXDataLoader(wsManager))
    
    // 配置专业的蜡烛图样式
    chart.setStyles({
      candle: {
        type: 'candle_solid',
        bar: {
          upColor: '#22c55e',
          downColor: '#ef4444',
          upBorderColor: '#22c55e',
          downBorderColor: '#ef4444',
          upWickColor: '#22c55e',
          downWickColor: '#ef4444'
        },
        priceMark: {
          high: {
            show: true,
            color: '#888'
          },
          low: {
            show: true,
            color: '#888'
          },
          last: {
            show: true,
            upColor: '#22c55e',
            downColor: '#ef4444',
            line: {
              show: true,
              style: 'dashed'
            }
          }
        }
      },
      grid: {
        show: true,
        horizontal: {
          show: true,
          color: '#e0e0e0'
        },
        vertical: {
          show: false
        }
      },
      crosshair: {
        show: true,
        horizontal: {
          show: true,
          line: {
            show: true,
            style: 'dashed',
            color: '#888'
          }
        },
        vertical: {
          show: true,
          line: {
            show: true,
            style: 'dashed',
            color: '#888'
          }
        }
      }
    })
    
    // 在主图上添加布林带指标
    chart.createIndicator({
      name: 'BOLL',
      calcParams: [20, 2],
      precision: 2,
      styles: {
        lines: [
          {
            style: 'solid',
            smooth: false,
            size: 1,
            color: '#FF6D00'  // 上轨：橙色
          },
          {
            style: 'solid',
            smooth: false,
            size: 1,
            color: '#2196F3'  // 中轨：蓝色
          },
          {
            style: 'solid',
            smooth: false,
            size: 1,
            color: '#00C853'  // 下轨：绿色
          }
        ]
      }
    }, true, { id: 'candle_pane' })
    
    console.log('✅ 已添加布林带指标 BOLL(20, 2)')
    
    // 创建成交量指标
    chart.createIndicator('VOL', false)
    
    // 创建MACD指标（在独立窗口）
    chart.createIndicator({
      name: 'MACD',
      calcParams: [12, 26, 9],  // 快线：12，慢线：26，信号线：9
      precision: 2,
      styles: {
        bars: [
          {
            upColor: 'rgba(34, 197, 94, 0.7)',
            downColor: 'rgba(239, 68, 68, 0.7)',
            noChangeColor: '#888888'
          }
        ],
        lines: [
          {
            style: 'solid',
            smooth: false,
            size: 1,
            color: '#FF6D00'  // DIF线：橙色
          },
          {
            style: 'solid',
            smooth: false,
            size: 1,
            color: '#2196F3'  // DEA线：蓝色
          }
        ]
      }
    }, false)
    
    console.log('✅ 已添加MACD指标 (12, 26, 9)')
    
    // 创建RSI指标（在独立窗口）
    chart.createIndicator({
      name: 'RSI',
      calcParams: [14],  // 周期：14
      precision: 2,
      styles: {
        lines: [
          {
            style: 'solid',
            smooth: false,
            size: 2,
            color: '#FF6D00'  // RSI线：橙色
          }
        ]
      }
    }, false)
    
    console.log('✅ 已添加RSI指标 (14)')
    
    // 设置可见K线数量和间距
    chart.setBarSpace(10)
    chart.setRightMinVisibleBarCount(3)
    chart.setLeftMinVisibleBarCount(3)
    
    // 更新状态
    status.value.loading = false
    status.value.dataLoaded = true
    status.value.connected = true
    
    // 滚动到最新数据
    setTimeout(() => {
      chart.scrollToRealTime()
      
      // 获取K线数量
      const dataList = chart.getDataList()
      stats.value.barCount = dataList.length
      stats.value.lastUpdate = new Date().toLocaleTimeString('zh-CN')
    }, 500)
    
    // 设置定时器更新统计信息
    const updateStatsInterval = setInterval(() => {
      if (chart) {
        const dataList = chart.getDataList()
        stats.value.barCount = dataList.length
        stats.value.lastUpdate = new Date().toLocaleTimeString('zh-CN')
      }
    }, 5000) // 每5秒更新一次
    
    // 保存定时器ID以便清理
    chart._updateStatsInterval = updateStatsInterval
    
  } catch (error) {
    console.error('❌ 初始化失败:', error)
    status.value.loading = false
    status.value.error = error.message
  }
})

onUnmounted(() => {
  // 清理定时器
  if (chart && chart._updateStatsInterval) {
    clearInterval(chart._updateStatsInterval)
  }
  
  // 断开 WebSocket
  if (wsManager) {
    wsManager.disconnect()
    console.log('🔌 WebSocket 已断开')
  }
  
  // 销毁图表
  if (chart) {
    dispose('kline-chart-realtime')
    console.log('🗑️ 图表已销毁')
  }
})
</script>

<template>
  <div class="kline-container">
    <!-- 头部信息栏 -->
    <div class="header">
      <div class="title-section">
        <h1>
          <span class="icon">📈</span>
          ETH/USDT 实时K线图
        </h1>
        <div class="badges">
          <span class="badge" :class="{ 'badge-success': status.connected, 'badge-error': !status.connected }">
            <span class="dot"></span>
            {{ status.connected ? '实时连接' : '未连接' }}
          </span>
          <span class="badge badge-info">
            日线 (1D)
          </span>
        </div>
      </div>
      <div class="info-section">
        <p class="data-source">数据来源：OKX 交易所 WebSocket 实时推送</p>
        <div class="stats">
          <span class="stat-item">
            <span class="label">K线数量：</span>
            <span class="value">{{ stats.barCount }}</span>
          </span>
          <span class="stat-item" v-if="stats.lastUpdate">
            <span class="label">最后更新：</span>
            <span class="value">{{ stats.lastUpdate }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="status.loading" class="status-overlay">
      <div class="loading-spinner"></div>
      <p>正在连接 OKX 交易所...</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="status.error" class="error-message">
      <div class="error-icon">⚠️</div>
      <h3>加载失败</h3>
      <p>{{ status.error }}</p>
    </div>

    <!-- K线图 -->
    <div 
      id="kline-chart-realtime" 
      ref="chartRef" 
      class="chart"
      :class="{ 'chart-loading': status.loading }"
    ></div>

    <!-- 底部说明 -->
    <div class="footer">
      <div class="feature-tags">
        <span class="tag">✅ WebSocket 实时推送</span>
        <span class="tag">✅ 自动重连机制</span>
        <span class="tag">✅ 布林带指标 (20, 2)</span>
        <span class="tag">✅ 成交量分析</span>
        <span class="tag">✅ MACD指标 (12, 26, 9)</span>
        <span class="tag">✅ RSI指标 (14)</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kline-container {
  width: 100%;
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  box-sizing: border-box;
  animation: fadeIn 0.6s ease-out;
}

.header {
  margin-bottom: 20px;
  padding: 25px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.title-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15px;
  flex-wrap: wrap;
  gap: 15px;
}

.header h1 {
  color: #333;
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon {
  font-size: 32px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.badges {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.badge-success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.badge-error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.badge-info {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: blink 2s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.info-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.data-source {
  color: #888;
  margin: 0;
  font-size: 14px;
  letter-spacing: 0.5px;
}

.stats {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  gap: 5px;
  font-size: 13px;
}

.stat-item .label {
  color: #888;
}

.stat-item .value {
  color: #333;
  font-weight: 600;
}

.status-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  z-index: 10;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #e0e0e0;
  border-top-color: #333;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-overlay p {
  color: #666;
  font-size: 16px;
  letter-spacing: 1px;
}

.error-message {
  text-align: center;
  padding: 40px;
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
  margin-bottom: 20px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 15px;
}

.error-message h3 {
  color: #ef4444;
  margin: 0 0 10px 0;
  font-size: 20px;
}

.error-message p {
  color: #888;
  margin: 0;
  font-size: 14px;
}

.chart {
  width: 100%;
  height: 700px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid #e0e0e0;
  overflow: hidden;
  transition: opacity 0.3s;
}

.chart-loading {
  opacity: 0.5;
}

.footer {
  margin-top: 20px;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.feature-tags {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.tag {
  padding: 8px 16px;
  background: #f5f5f5;
  color: #555;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid #e0e0e0;
}

@media (max-width: 768px) {
  .kline-container {
    padding: 10px;
  }

  .chart {
    height: 500px;
    border-radius: 8px;
  }

  .header {
    padding: 15px;
    margin-bottom: 15px;
  }

  .header h1 {
    font-size: 22px;
  }

  .title-section {
    flex-direction: column;
    align-items: flex-start;
  }

  .info-section {
    flex-direction: column;
    align-items: flex-start;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

