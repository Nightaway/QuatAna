<template>
  <div class="backtest-results">
    <div class="metrics-cards">
      <div class="metric-card" :class="{ positive: metrics.totalReturnPercent > 0, negative: metrics.totalReturnPercent < 0 }">
        <div class="metric-label">总收益率</div>
        <div class="metric-value">{{ formatPercent(metrics.totalReturnPercent) }}</div>
        <div class="metric-sub">{{ formatCurrency(metrics.totalReturn) }}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">胜率</div>
        <div class="metric-value">{{ formatPercent(metrics.winRate) }}</div>
        <div class="metric-sub">{{ metrics.winningTrades }}/{{ metrics.totalTrades }} 笔</div>
      </div>

      <div class="metric-card negative">
        <div class="metric-label">最大回撤</div>
        <div class="metric-value">{{ formatPercent(metrics.maxDrawdownPercent) }}</div>
        <div class="metric-sub">{{ formatCurrency(metrics.maxDrawdown) }}</div>
      </div>

      <div class="metric-card" :class="{ positive: metrics.sharpeRatio > 1, negative: metrics.sharpeRatio < 0 }">
        <div class="metric-label">夏普比率</div>
        <div class="metric-value">{{ formatNumber(metrics.sharpeRatio) }}</div>
        <div class="metric-sub">年化风险调整收益</div>
      </div>
    </div>

    <div class="detail-section">
      <div class="section-tabs">
        <button
          :class="{ active: activeTab === 'stats' }"
          @click="activeTab = 'stats'"
        >
          详细统计
        </button>
        <button
          :class="{ active: activeTab === 'trades' }"
          @click="activeTab = 'trades'"
        >
          交易记录
        </button>
        <button
          :class="{ active: activeTab === 'equity' }"
          @click="activeTab = 'equity'"
        >
          权益曲线
        </button>
      </div>

      <div v-if="activeTab === 'stats'" class="stats-panel">
        <div class="stats-grid">
          <div class="stat-row">
            <span class="label">初始资金</span>
            <span class="value">{{ formatCurrency(initialCapital) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">最终资金</span>
            <span class="value">{{ formatCurrency(metrics.finalCapital) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">总交易次数</span>
            <span class="value">{{ metrics.totalTrades }}</span>
          </div>
          <div class="stat-row">
            <span class="label">盈利交易</span>
            <span class="value positive">{{ metrics.winningTrades }}</span>
          </div>
          <div class="stat-row">
            <span class="label">亏损交易</span>
            <span class="value negative">{{ metrics.losingTrades }}</span>
          </div>
          <div class="stat-row">
            <span class="label">平均盈利</span>
            <span class="value positive">{{ formatCurrency(metrics.avgWin) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">平均亏损</span>
            <span class="value negative">{{ formatCurrency(metrics.avgLoss) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">盈亏比</span>
            <span class="value">{{ formatNumber(metrics.profitLossRatio) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">利润因子</span>
            <span class="value">{{ formatNumber(metrics.profitFactor) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">最大连续盈利</span>
            <span class="value">{{ metrics.maxConsecutiveWins }} 次</span>
          </div>
          <div class="stat-row">
            <span class="label">最大连续亏损</span>
            <span class="value">{{ metrics.maxConsecutiveLosses }} 次</span>
          </div>
          <div class="stat-row">
            <span class="label">平均持仓时间</span>
            <span class="value">{{ metrics.avgHoldingPeriod }}</span>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'trades'" class="trades-panel">
        <div class="trades-table-wrapper">
          <table class="trades-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>价格</th>
                <th>数量</th>
                <th>手续费</th>
                <th>盈亏</th>
                <th>信号</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="trade in trades" :key="trade.id">
                <td>{{ formatTime(trade.timestamp) }}</td>
                <td>
                  <span class="trade-type" :class="trade.type.toLowerCase()">
                    {{ getTradeTypeLabel(trade) }}
                  </span>
                </td>
                <td>{{ trade.price.toFixed(2) }}</td>
                <td>{{ trade.quantity.toFixed(4) }}</td>
                <td>{{ trade.fee.toFixed(2) }}</td>
                <td :class="{ positive: trade.pnl > 0, negative: trade.pnl < 0 }">
                  {{ trade.pnl !== 0 ? formatCurrency(trade.pnl) : '-' }}
                </td>
                <td class="signal-cell">{{ trade.signal }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="activeTab === 'equity'" class="equity-panel">
        <div class="equity-chart" ref="equityChartRef"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { formatNumber, formatPercent, formatCurrency } from '~/utils/performanceMetrics'

const props = defineProps({
  metrics: {
    type: Object,
    required: true
  },
  trades: {
    type: Array,
    default: () => []
  },
  initialCapital: {
    type: Number,
    default: 100000
  }
})

const activeTab = ref('stats')
const equityChartRef = ref(null)
let equityChart = null

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getTradeTypeLabel(trade) {
  const labels = {
    'OPEN_LONG': '开多',
    'CLOSE_LONG': '平多',
    'OPEN_SHORT': '开空',
    'CLOSE_SHORT': '平空'
  }
  return labels[trade.action] || trade.type
}

// 绘制权益曲线
async function drawEquityChart() {
  if (!equityChartRef.value || !props.metrics.equityCurve) return

  await nextTick()

  const canvas = document.createElement('canvas')
  canvas.width = equityChartRef.value.clientWidth * 2
  canvas.height = 300 * 2
  canvas.style.width = '100%'
  canvas.style.height = '300px'

  equityChartRef.value.innerHTML = ''
  equityChartRef.value.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  ctx.scale(2, 2)

  const data = props.metrics.equityCurve
  const width = equityChartRef.value.clientWidth
  const height = 300
  const padding = { top: 20, right: 20, bottom: 30, left: 70 }

  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // 计算数据范围
  const equities = data.map(d => d.equity)
  const minEquity = Math.min(...equities) * 0.99
  const maxEquity = Math.max(...equities) * 1.01

  // 绘制背景
  ctx.fillStyle = '#f9f9f9'
  ctx.fillRect(0, 0, width, height)

  // 绘制网格线
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 1

  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()

    // Y轴标签
    const value = maxEquity - ((maxEquity - minEquity) / 4) * i
    ctx.fillStyle = '#888'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(value.toFixed(0), padding.left - 10, y + 4)
  }

  // 绘制权益曲线
  ctx.beginPath()
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 2

  data.forEach((point, index) => {
    const x = padding.left + (index / (data.length - 1)) * chartWidth
    const y = padding.top + ((maxEquity - point.equity) / (maxEquity - minEquity)) * chartHeight

    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  ctx.stroke()

  // 绘制初始资金线
  const initialY = padding.top + ((maxEquity - props.initialCapital) / (maxEquity - minEquity)) * chartHeight
  ctx.beginPath()
  ctx.strokeStyle = '#ccc'
  ctx.setLineDash([5, 5])
  ctx.moveTo(padding.left, initialY)
  ctx.lineTo(width - padding.right, initialY)
  ctx.stroke()
  ctx.setLineDash([])
}

watch(() => props.metrics, () => {
  if (activeTab.value === 'equity') {
    drawEquityChart()
  }
}, { deep: true })

watch(activeTab, (newVal) => {
  if (newVal === 'equity') {
    nextTick(() => drawEquityChart())
  }
})

onMounted(() => {
  if (activeTab.value === 'equity') {
    drawEquityChart()
  }
})
</script>

<style scoped>
.backtest-results {
  padding: 20px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.metrics-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 25px;
}

.metric-card {
  padding: 20px;
  background: #f9f9f9;
  border-radius: 12px;
  text-align: center;
  border: 1px solid #e0e0e0;
}

.metric-card.positive .metric-value {
  color: #22c55e;
}

.metric-card.negative .metric-value {
  color: #ef4444;
}

.metric-label {
  font-size: 13px;
  color: #888;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin-bottom: 5px;
}

.metric-sub {
  font-size: 12px;
  color: #aaa;
}

.section-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 15px;
}

.section-tabs button {
  padding: 10px 20px;
  background: transparent;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.section-tabs button.active {
  background: #333;
  border-color: #333;
  color: #fff;
}

.section-tabs button:hover:not(.active) {
  background: #f5f5f5;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 15px;
  background: #f9f9f9;
  border-radius: 8px;
}

.stat-row .label {
  color: #888;
  font-size: 13px;
}

.stat-row .value {
  color: #333;
  font-size: 14px;
  font-weight: 500;
}

.stat-row .value.positive {
  color: #22c55e;
}

.stat-row .value.negative {
  color: #ef4444;
}

.trades-table-wrapper {
  max-height: 400px;
  overflow-y: auto;
}

.trades-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.trades-table th,
.trades-table td {
  padding: 12px 10px;
  text-align: right;
  border-bottom: 1px solid #e0e0e0;
}

.trades-table th {
  color: #888;
  font-weight: 500;
  position: sticky;
  top: 0;
  background: #fff;
}

.trades-table td {
  color: #333;
}

.trades-table th:first-child,
.trades-table td:first-child {
  text-align: left;
}

.trade-type {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.trade-type.buy {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.trade-type.sell {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.signal-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left !important;
  color: #888 !important;
  font-size: 12px;
}

.positive {
  color: #22c55e !important;
}

.negative {
  color: #ef4444 !important;
}

.equity-chart {
  width: 100%;
  height: 300px;
  border-radius: 8px;
  overflow: hidden;
}

@media (max-width: 1200px) {
  .metrics-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .metrics-cards {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
