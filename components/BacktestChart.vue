<template>
  <div class="backtest-chart-container">
    <div id="backtest-chart" ref="chartContainer" class="chart-wrapper"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  trades: {
    type: Array,
    default: () => []
  },
  strategy: {
    type: Object,
    default: () => null
    // { name: 'ma'|'macd'|'rsi'|'boll', params: {...} }
  },
  period: {
    type: Object,
    default: () => ({ span: 1, type: 'day' })
  }
})

const chartContainer = ref(null)
let chart = null
let disposeChart = null // 保存 dispose 函数引用
let currentIndicatorPaneIds = [] // 存储当前策略指标的窗格ID

// 策略与指标的映射配置
const STRATEGY_INDICATORS = {
  ma: (params) => ({
    mainChart: [
      {
        name: 'MA',
        calcParams: [params.fastPeriod || 5],
        styles: {
          lines: [{
            style: 'solid',
            smooth: false,
            size: 2,
            color: '#FF6D00' // 快速线：橙色
          }]
        }
      },
      {
        name: 'MA',
        calcParams: [params.slowPeriod || 20],
        styles: {
          lines: [{
            style: 'solid',
            smooth: false,
            size: 2,
            color: '#2196F3' // 慢速线：蓝色
          }]
        }
      }
    ],
    subChart: []
  }),
  macd: (params) => ({
    mainChart: [],
    subChart: [
      {
        name: 'MACD',
        calcParams: [params.fastPeriod || 12, params.slowPeriod || 26, params.signalPeriod || 9],
        styles: {
          bars: [{
            upColor: 'rgba(38, 166, 154, 0.7)',
            downColor: 'rgba(239, 83, 80, 0.7)',
            noChangeColor: '#888888'
          }],
          lines: [
            {
              style: 'solid',
              smooth: false,
              size: 1,
              color: '#FF6D00' // DIF线：橙色
            },
            {
              style: 'solid',
              smooth: false,
              size: 1,
              color: '#2196F3' // DEA线：蓝色
            }
          ]
        }
      }
    ]
  }),
  rsi: (params) => ({
    mainChart: [],
    subChart: [
      {
        name: 'RSI',
        calcParams: [params.period || 14],
        styles: {
          lines: [{
            style: 'solid',
            smooth: false,
            size: 2,
            color: '#FF6D00' // RSI线：橙色
          }]
        }
      }
    ]
  }),
  boll: (params) => ({
    mainChart: [
      {
        name: 'BOLL',
        calcParams: [params.period || 20, params.stdDev || 2],
        styles: {
          lines: [
            {
              style: 'solid',
              smooth: false,
              size: 1,
              color: '#FF6D00' // 上轨：橙色
            },
            {
              style: 'solid',
              smooth: false,
              size: 1,
              color: '#2196F3' // 中轨：蓝色
            },
            {
              style: 'solid',
              smooth: false,
              size: 1,
              color: '#00C853' // 下轨：绿色
            }
          ]
        }
      }
    ],
    subChart: []
  }),
  bollExtreme: (params) => ({
    mainChart: [
      {
        name: 'BOLL',
        calcParams: [params.period || 20, params.stdDev || 2],
        styles: {
          lines: [
            {
              style: 'solid',
              smooth: false,
              size: 1,
              color: '#FF6D00' // 上轨：橙色
            },
            {
              style: 'solid',
              smooth: false,
              size: 1,
              color: '#2196F3' // 中轨：蓝色
            },
            {
              style: 'solid',
              smooth: false,
              size: 1,
              color: '#00C853' // 下轨：绿色
            }
          ]
        }
      }
    ],
    subChart: []
  })
}

// 更新策略指标
function updateIndicators(strategy) {
  if (!chart) return

  // 移除旧的策略指标窗格
  currentIndicatorPaneIds.forEach(paneId => {
    chart.removeIndicator(paneId)
  })
  currentIndicatorPaneIds = []

  // 移除主图上的策略指标（MA、BOLL）
  chart.removeIndicator('candle_pane', 'MA')
  chart.removeIndicator('candle_pane', 'BOLL')

  if (!strategy || !strategy.name) return

  const indicatorConfig = STRATEGY_INDICATORS[strategy.name]
  if (!indicatorConfig) return

  const config = indicatorConfig(strategy.params || {})

  // 添加主图指标
  config.mainChart.forEach(indicator => {
    chart.createIndicator(indicator, true, { id: 'candle_pane' })
  })

  // 添加副图指标
  config.subChart.forEach(indicator => {
    const paneId = chart.createIndicator(indicator, false)
    if (paneId) {
      currentIndicatorPaneIds.push(paneId)
    }
  })
}

// 注册自定义买卖标记 overlay
function registerTradeOverlay({ registerOverlay }) {
  // 持仓区间背景
  registerOverlay({
    name: 'positionBackground',
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    totalStep: 2,
    createPointFigures: ({ coordinates, bounding, overlay }) => {
      if (coordinates.length < 2) return []

      const startX = coordinates[0].x
      const endX = coordinates[1].x
      // 从 extendData 读取颜色，默认为灰色
      const bgColor = overlay.extendData?.color || 'rgba(0, 0, 0, 0.04)'

      return [
        {
          type: 'rect',
          attrs: {
            x: Math.min(startX, endX),
            y: 0,
            width: Math.abs(endX - startX),
            height: bounding.height
          },
          styles: {
            style: 'fill',
            color: bgColor
          }
        }
      ]
    }
  })

  // 买入标记
  registerOverlay({
    name: 'buyMarker',
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    totalStep: 1,
    createPointFigures: ({ coordinates, overlay }) => {
      const point = coordinates[0]
      if (!point) return []

      return [
        {
          type: 'polygon',
          attrs: {
            coordinates: [
              { x: point.x, y: point.y - 20 },
              { x: point.x - 10, y: point.y },
              { x: point.x + 10, y: point.y }
            ]
          },
          styles: {
            style: 'fill',
            color: '#22c55e'
          }
        },
        {
          type: 'text',
          attrs: {
            x: point.x,
            y: point.y - 25,
            text: 'B',
            align: 'center',
            baseline: 'bottom'
          },
          styles: {
            color: '#22c55e',
            size: 12,
            weight: 'bold'
          }
        }
      ]
    }
  })

  // 卖出标记
  registerOverlay({
    name: 'sellMarker',
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    totalStep: 1,
    createPointFigures: ({ coordinates, overlay }) => {
      const point = coordinates[0]
      if (!point) return []

      return [
        {
          type: 'polygon',
          attrs: {
            coordinates: [
              { x: point.x, y: point.y + 20 },
              { x: point.x - 10, y: point.y },
              { x: point.x + 10, y: point.y }
            ]
          },
          styles: {
            style: 'fill',
            color: '#ef4444'
          }
        },
        {
          type: 'text',
          attrs: {
            x: point.x,
            y: point.y + 25,
            text: 'S',
            align: 'center',
            baseline: 'top'
          },
          styles: {
            color: '#ef4444',
            size: 12,
            weight: 'bold'
          }
        }
      ]
    }
  })

  // 布林带极值标记（与静态页面 KLineChart.vue 一致）
  registerOverlay({
    name: 'bollExtremeMarker',
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    totalStep: 2,
    createPointFigures: ({ coordinates, overlay }) => {
      if (coordinates.length < 1) return []

      const isUpper = overlay.extendData?.isUpper
      const color = isUpper ? '#a855f7' : '#06b6d4'
      const x = coordinates[0].x
      const y = coordinates[0].y
      const size = 8

      let points
      if (isUpper) {
        // 向下三角形（上轨突破，在K线上方）
        points = [
          { x: x, y: y - size * 2 },
          { x: x - size, y: y - size * 2 - size * 1.5 },
          { x: x + size, y: y - size * 2 - size * 1.5 }
        ]
      } else {
        // 向上三角形（下轨突破，在K线下方）
        points = [
          { x: x, y: y + size * 2 },
          { x: x - size, y: y + size * 2 + size * 1.5 },
          { x: x + size, y: y + size * 2 + size * 1.5 }
        ]
      }

      return [{
        type: 'polygon',
        attrs: { coordinates: points },
        styles: {
          style: 'fill',
          color: color
        }
      }]
    }
  })
}

async function initChart() {
  if (!chartContainer.value) return

  const { init, dispose, registerOverlay } = await import('klinecharts')
  disposeChart = dispose

  // 注册自定义 overlay
  registerTradeOverlay({ registerOverlay })

  // 创建图表 - 使用 ID 字符串
  chart = init('backtest-chart', {
    styles: {
      grid: {
        show: true,
        horizontal: {
          show: true,
          size: 1,
          color: '#e0e0e0',
          style: 'dashed'
        },
        vertical: {
          show: true,
          size: 1,
          color: '#e0e0e0',
          style: 'dashed'
        }
      },
      candle: {
        type: 'candle_solid',
        priceMark: {
          show: true,
          high: {
            show: true,
            color: '#888',
            textSize: 10
          },
          low: {
            show: true,
            color: '#888',
            textSize: 10
          },
          last: {
            show: true,
            upColor: '#22c55e',
            downColor: '#ef4444',
            noChangeColor: '#888',
            line: {
              show: true,
              style: 'dashed',
              size: 1
            },
            text: {
              show: true,
              size: 11,
              paddingLeft: 4,
              paddingTop: 2,
              paddingRight: 4,
              paddingBottom: 2,
              color: '#fff'
            }
          }
        },
        bar: {
          upColor: '#22c55e',
          downColor: '#ef4444',
          noChangeColor: '#888',
          upBorderColor: '#22c55e',
          downBorderColor: '#ef4444',
          noChangeBorderColor: '#888'
        }
      },
      indicator: {
        lastValueMark: {
          show: true,
          text: {
            show: true,
            color: '#fff',
            size: 10
          }
        },
        tooltip: {
          showRule: 'follow_cross',
          showType: 'rect',
          text: {
            size: 11,
            color: '#333'
          }
        }
      },
      xAxis: {
        show: true,
        axisLine: {
          show: true,
          color: '#ccc',
          size: 1
        },
        tickText: {
          show: true,
          color: '#666',
          size: 11
        },
        tickLine: {
          show: true,
          size: 1,
          color: '#ccc'
        }
      },
      yAxis: {
        show: true,
        axisLine: {
          show: true,
          color: '#ccc',
          size: 1
        },
        tickText: {
          show: true,
          color: '#666',
          size: 11
        },
        tickLine: {
          show: true,
          size: 1,
          color: '#ccc'
        }
      },
      crosshair: {
        show: true,
        horizontal: {
          show: true,
          line: {
            show: true,
            style: 'dashed',
            size: 1,
            color: '#888'
          },
          text: {
            show: true,
            color: '#fff',
            size: 11,
            backgroundColor: '#555'
          }
        },
        vertical: {
          show: true,
          line: {
            show: true,
            style: 'dashed',
            size: 1,
            color: '#888'
          },
          text: {
            show: true,
            color: '#fff',
            size: 11,
            backgroundColor: '#555'
          }
        }
      }
    }
  })

  // 检查 chart 是否成功初始化
  if (!chart) {
    console.error('图表初始化失败：无法找到 DOM 元素')
    return
  }

  // v10 API: 设置交易对信息和周期（必须在 setDataLoader 之前调用）
  chart.setSymbol({
    ticker: 'ETH-USDT',
    exchange: 'OKX'
  })

  chart.setPeriod(props.period)

  // 创建成交量指标
  chart.createIndicator('VOL', false, { id: 'candle_pane' })

  // 设置数据加载器 (v10 API)
  chart.setDataLoader({
    getBars: ({ callback }) => {
      if (props.data.length > 0) {
        callback(props.data)
      } else {
        callback([])
      }
    }
  })

  // 加载数据后添加交易标记
  if (props.data.length > 0) {
    addTradeMarkers()
  }
}

function addTradeMarkers() {
  if (!chart || !props.trades.length) return

  // 移除旧的标记
  chart.removeOverlay()

  // 按开仓/平仓配对交易，绘制持仓区间背景
  // 支持做多（OPEN_LONG → CLOSE_LONG）和做空（OPEN_SHORT → CLOSE_SHORT）
  let openTrade = null
  for (let i = 0; i < props.trades.length; i++) {
    const trade = props.trades[i]
    if (trade.action === 'OPEN_LONG' || trade.action === 'OPEN_SHORT') {
      openTrade = trade
    } else if (openTrade && (trade.action === 'CLOSE_LONG' || trade.action === 'CLOSE_SHORT')) {
      const closeTrade = trade
      // 根据盈亏决定背景颜色
      const isProfit = closeTrade.pnl > 0
      const bgColor = isProfit
        ? 'rgba(34, 197, 94, 0.1)'   // 盈利：绿色
        : 'rgba(239, 68, 68, 0.1)'   // 亏损：红色

      chart.createOverlay({
        name: 'positionBackground',
        points: [
          { timestamp: openTrade.timestamp, value: openTrade.price },
          { timestamp: closeTrade.timestamp, value: closeTrade.price }
        ],
        extendData: { color: bgColor },
        lock: true,
        zLevel: -1
      })
      openTrade = null
    }
  }

  // 添加买卖标记
  const isBollExtreme = props.strategy?.name === 'bollExtreme'
  // 为 bollExtreme 策略建立 timestamp → K线数据的索引
  let dataMap = null
  if (isBollExtreme && props.data.length > 0) {
    dataMap = new Map()
    props.data.forEach(bar => dataMap.set(bar.timestamp, bar))
  }

  props.trades.forEach(trade => {
    const isOpen = trade.action === 'OPEN_LONG' || trade.action === 'OPEN_SHORT'

    if (isBollExtreme && isOpen) {
      // 布林带极值标记：与静态页面一致的紫色/青色三角形
      const isUpper = trade.action === 'OPEN_SHORT' // 做空 = 上轨突破
      const bar = dataMap?.get(trade.timestamp)
      const pointValue = bar
        ? (isUpper ? bar.high : bar.low)
        : trade.price

      chart.createOverlay({
        name: 'bollExtremeMarker',
        points: [{ timestamp: trade.timestamp, value: pointValue }],
        extendData: { isUpper },
        lock: true
      })
    } else {
      // 标准买卖标记
      const overlayName = trade.type === 'BUY' ? 'buyMarker' : 'sellMarker'

      chart.createOverlay({
        name: overlayName,
        points: [
          {
            timestamp: trade.timestamp,
            value: trade.price
          }
        ],
        lock: true
      })
    }
  })
}

function updateChart() {
  if (!chart) return

  if (props.data.length > 0) {
    // 更新周期
    chart.setPeriod(props.period)

    // v10 API: 重新设置数据加载器并触发重新加载
    chart.setDataLoader({
      getBars: ({ callback }) => {
        callback(props.data)
      }
    })
    addTradeMarkers()
  }
}

watch(() => props.data, () => {
  nextTick(() => updateChart())
}, { deep: true })

watch(() => props.period, () => {
  nextTick(() => updateChart())
}, { deep: true })

watch(() => props.trades, () => {
  nextTick(() => addTradeMarkers())
}, { deep: true })

watch(() => props.strategy, (newStrategy) => {
  nextTick(() => updateIndicators(newStrategy))
}, { deep: true })

onMounted(() => {
  nextTick(() => initChart())
})

onUnmounted(() => {
  if (chart && disposeChart) {
    disposeChart('backtest-chart')
    chart = null
  }
})

defineExpose({
  refresh: updateChart
})
</script>

<style scoped>
.backtest-chart-container {
  width: 100%;
  height: 100%;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.chart-wrapper {
  width: 100%;
  height: 500px;
}
</style>
