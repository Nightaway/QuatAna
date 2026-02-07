<script setup>
import { onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import { init, dispose, registerOverlay } from 'klinecharts'

// 从JSON文件导入数据
import dailyData from '../public/hstech_daily_20200701_20260205.json'

// 导入趋势识别工具
import { detectTrends, TREND_COLORS, TREND_NAMES, getTrendStats } from '../utils/trendDetector'

// 导入布林带计算
import { calculateBOLL } from '../utils/indicators'

const chartRef = ref(null)
let chart = null

// 趋势线相关状态
const showTrendLines = ref(false)
const sidewaysThreshold = ref(1)  // 横盘阈值百分比
const minTrendLength = ref(2)     // 最小趋势长度
const trendStats = ref(null)      // 趋势统计信息
let trendOverlayIds = []          // 存储已创建的趋势线overlay ID
let currentKlineData = []         // 当前K线数据缓存

// 对话框显示状态
const showSettingsDialog = ref(false)

// 布林带极值相关状态
const showBollExtremes = ref(false)
const bollPeriod = ref(20)
const bollStdDev = ref(2)
const bollReversionWindow = ref(5)
const bollExtremeStats = ref(null)
const bollBandFilter = ref('both')        // 'upper' | 'lower' | 'both'
const bollPenetrationMode = ref('full')   // 'full' | 'partial'
const bollPartialRatio = ref(50)          // 10-90, percentage of body that must cross the band
let bollExtremeOverlayIds = []

// 跳空缺口相关状态
const showGaps = ref(false)
const gapThreshold = ref(0.5)    // 缺口最小幅度百分比
const gapStats = ref(null)       // 缺口统计信息
let gapOverlayIds = []           // 存储已创建的缺口overlay ID

// 注册自定义趋势线 overlay（加粗线段 + 转折点圆圈）
registerOverlay({
  name: 'trendSegment',
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  totalStep: 3,
  createPointFigures: ({ coordinates, overlay }) => {
    if (coordinates.length < 2) return []

    const color = overlay.extendData?.color || '#888'
    const figures = []

    // 1. 粗线段
    figures.push({
      type: 'line',
      attrs: {
        coordinates: [coordinates[0], coordinates[1]]
      },
      styles: {
        style: 'solid',
        color: color,
        size: 4
      }
    })

    // 2. 起点圆圈
    figures.push({
      type: 'circle',
      attrs: {
        ...coordinates[0],
        r: 5
      },
      styles: {
        style: 'fill',
        color: color
      }
    })

    // 3. 终点圆圈
    figures.push({
      type: 'circle',
      attrs: {
        ...coordinates[1],
        r: 5
      },
      styles: {
        style: 'fill',
        color: color
      }
    })

    return figures
  }
})

// 注册自定义跳空缺口 overlay（半透明矩形区域）
registerOverlay({
  name: 'gapZone',
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: false,
  needDefaultYAxisFigure: false,
  totalStep: 3,
  createPointFigures: ({ coordinates, overlay }) => {
    if (coordinates.length < 2) return []

    const color = overlay.extendData?.color || 'rgba(128,128,128,0.2)'
    const borderColor = overlay.extendData?.borderColor || '#888'
    const figures = []

    const x1 = coordinates[0].x
    const y1 = coordinates[0].y
    const x2 = coordinates[1].x
    const y2 = coordinates[1].y

    // 半透明填充矩形
    figures.push({
      type: 'rect',
      attrs: {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1)
      },
      styles: {
        style: 'fill',
        color: color
      }
    })

    // 上下边界虚线
    figures.push({
      type: 'line',
      attrs: {
        coordinates: [
          { x: Math.min(x1, x2), y: y1 },
          { x: Math.max(x1, x2), y: y1 }
        ]
      },
      styles: {
        style: 'dashed',
        color: borderColor,
        size: 1,
        dashedValue: [4, 4]
      }
    })
    figures.push({
      type: 'line',
      attrs: {
        coordinates: [
          { x: Math.min(x1, x2), y: y2 },
          { x: Math.max(x1, x2), y: y2 }
        ]
      },
      styles: {
        style: 'dashed',
        color: borderColor,
        size: 1,
        dashedValue: [4, 4]
      }
    })

    return figures
  }
})

// 注册自定义布林带极值标记 overlay（三角形标记）
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

    // 三角形顶点
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

// 检测跳空缺口
const detectGaps = (data, threshold = 0.5) => {
  const gaps = []
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1]
    const curr = data[i]

    // 向上跳空: 当前最低价 > 前一根最高价
    if (curr.low > prev.high) {
      const gapSize = curr.low - prev.high
      const gapPercent = (gapSize / prev.close) * 100
      if (gapPercent >= threshold) {
        gaps.push({
          type: 'up',
          index: i,
          prevTimestamp: prev.timestamp,
          currTimestamp: curr.timestamp,
          gapTop: curr.low,     // 缺口上沿
          gapBottom: prev.high, // 缺口下沿
          gapSize,
          gapPercent: Math.round(gapPercent * 100) / 100
        })
      }
    }

    // 向下跳空: 当前最高价 < 前一根最低价
    if (curr.high < prev.low) {
      const gapSize = prev.low - curr.high
      const gapPercent = (gapSize / prev.close) * 100
      if (gapPercent >= threshold) {
        gaps.push({
          type: 'down',
          index: i,
          prevTimestamp: prev.timestamp,
          currTimestamp: curr.timestamp,
          gapTop: prev.low,    // 缺口上沿
          gapBottom: curr.high, // 缺口下沿
          gapSize,
          gapPercent: Math.round(gapPercent * 100) / 100
        })
      }
    }
  }
  return gaps
}

// 清除所有缺口标记
const clearGaps = () => {
  if (!chart) return
  gapOverlayIds.forEach(id => {
    chart.removeOverlay({ id })
  })
  gapOverlayIds = []
  gapStats.value = null
}

// 绘制跳空缺口
const drawGaps = () => {
  if (!chart || !currentKlineData.length) return

  clearGaps()

  const gaps = detectGaps(currentKlineData, gapThreshold.value)

  if (gaps.length === 0) {
    gapStats.value = { total: 0, up: 0, down: 0 }
    return
  }

  const upCount = gaps.filter(g => g.type === 'up').length
  const downCount = gaps.filter(g => g.type === 'down').length
  gapStats.value = { total: gaps.length, up: upCount, down: downCount }

  gaps.forEach(gap => {
    const isUp = gap.type === 'up'
    const color = isUp ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'
    const borderColor = isUp ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'

    const overlayId = chart.createOverlay({
      name: 'gapZone',
      points: [
        { timestamp: gap.prevTimestamp, value: gap.gapTop },
        { timestamp: gap.currTimestamp, value: gap.gapBottom }
      ],
      extendData: { color, borderColor },
      lock: true,
      visible: true
    })

    if (overlayId) {
      gapOverlayIds.push(overlayId)
    }
  })

  console.log(`已标记 ${gaps.length} 个跳空缺口：向上 ${upCount}, 向下 ${downCount}`)
}

// 切换缺口显示
const toggleGaps = () => {
  if (showGaps.value) {
    drawGaps()
  } else {
    clearGaps()
  }
}

// 监听缺口阈值变化
watch(gapThreshold, () => {
  if (showGaps.value) {
    drawGaps()
  }
})

// 检测布林带极值K线
const detectBollExtremes = (data, period = 20, stdDev = 2, reversionWindow = 5, bandFilter = 'both', penetrationMode = 'full', partialRatio = 50) => {
  const boll = calculateBOLL(data, period, stdDev)
  const extremes = []

  for (let i = 0; i < data.length; i++) {
    if (boll.upper[i] === null) continue

    const candle = data[i]
    const bodyHigh = Math.max(candle.open, candle.close)
    const bodyLow = Math.min(candle.open, candle.close)
    const bodyRange = bodyHigh - bodyLow

    let type = null
    let penetrationDepth = 0

    if (penetrationMode === 'full') {
      // 完全突破模式：实体完全在轨道之外
      if (bandFilter !== 'lower' && bodyLow > boll.upper[i]) {
        type = 'upper'
        penetrationDepth = bodyLow - boll.upper[i]
      } else if (bandFilter !== 'upper' && bodyHigh < boll.lower[i]) {
        type = 'lower'
        penetrationDepth = boll.lower[i] - bodyHigh
      }
    } else {
      // 部分突破模式：实体部分穿越轨道，达到指定比例
      if (bandFilter !== 'lower' && bodyHigh > boll.upper[i]) {
        const crossAmount = bodyHigh - boll.upper[i]
        const ratio = bodyRange > 0 ? (crossAmount / bodyRange) * 100 : 0
        if (ratio >= partialRatio) {
          type = 'upper'
          penetrationDepth = crossAmount
        }
      }
      if (!type && bandFilter !== 'upper' && bodyLow < boll.lower[i]) {
        const crossAmount = boll.lower[i] - bodyLow
        const ratio = bodyRange > 0 ? (crossAmount / bodyRange) * 100 : 0
        if (ratio >= partialRatio) {
          type = 'lower'
          penetrationDepth = crossAmount
        }
      }
    }

    if (!type) continue

    // 均值回归检测
    let reverted = false
    let reversionBars = null
    for (let j = 1; j <= reversionWindow && i + j < data.length; j++) {
      const futureCandle = data[i + j]
      if (boll.upper[i + j] === null) continue
      const futureBodyHigh = Math.max(futureCandle.open, futureCandle.close)
      const futureBodyLow = Math.min(futureCandle.open, futureCandle.close)

      if (type === 'upper' && futureBodyLow <= boll.upper[i + j]) {
        reverted = true
        reversionBars = j
        break
      }
      if (type === 'lower' && futureBodyHigh >= boll.lower[i + j]) {
        reverted = true
        reversionBars = j
        break
      }
    }

    extremes.push({
      type,
      index: i,
      timestamp: candle.timestamp,
      high: candle.high,
      low: candle.low,
      open: candle.open,
      close: candle.close,
      bollUpper: boll.upper[i],
      bollLower: boll.lower[i],
      bollMiddle: boll.middle[i],
      penetrationDepth,
      reverted,
      reversionBars
    })
  }

  return extremes
}

// 计算布林带极值统计
const calcBollExtremeStats = (extremes, totalBars) => {
  const upperExtremes = extremes.filter(e => e.type === 'upper')
  const lowerExtremes = extremes.filter(e => e.type === 'lower')
  const revertedExtremes = extremes.filter(e => e.reverted)
  const revertedBars = revertedExtremes.map(e => e.reversionBars)
  const avgReversionBars = revertedBars.length > 0
    ? (revertedBars.reduce((a, b) => a + b, 0) / revertedBars.length)
    : 0

  // 最大连续极值K线数
  let maxConsecutive = 0
  let currentConsecutive = 0
  let prevIndex = -2
  for (const e of extremes) {
    if (e.index === prevIndex + 1) {
      currentConsecutive++
    } else {
      currentConsecutive = 1
    }
    if (currentConsecutive > maxConsecutive) {
      maxConsecutive = currentConsecutive
    }
    prevIndex = e.index
  }

  return {
    total: extremes.length,
    upper: upperExtremes.length,
    lower: lowerExtremes.length,
    percent: totalBars > 0 ? ((extremes.length / totalBars) * 100).toFixed(1) : '0.0',
    reversionRate: extremes.length > 0
      ? ((revertedExtremes.length / extremes.length) * 100).toFixed(1)
      : '0.0',
    avgReversionBars: avgReversionBars.toFixed(1),
    maxConsecutive
  }
}

// 清除所有布林带极值标记
const clearBollExtremes = () => {
  if (!chart) return
  bollExtremeOverlayIds.forEach(id => {
    chart.removeOverlay({ id })
  })
  bollExtremeOverlayIds = []
  bollExtremeStats.value = null
}

// 绘制布林带极值标记
const drawBollExtremes = () => {
  if (!chart || !currentKlineData.length) return

  clearBollExtremes()

  const extremes = detectBollExtremes(
    currentKlineData,
    bollPeriod.value,
    bollStdDev.value,
    bollReversionWindow.value,
    bollBandFilter.value,
    bollPenetrationMode.value,
    bollPartialRatio.value
  )

  bollExtremeStats.value = calcBollExtremeStats(extremes, currentKlineData.length)

  if (extremes.length === 0) return

  extremes.forEach(extreme => {
    const isUpper = extreme.type === 'upper'
    const pointValue = isUpper ? extreme.high : extreme.low

    const overlayId = chart.createOverlay({
      name: 'bollExtremeMarker',
      points: [
        { timestamp: extreme.timestamp, value: pointValue }
      ],
      extendData: { isUpper },
      lock: true,
      visible: true
    })

    if (overlayId) {
      bollExtremeOverlayIds.push(overlayId)
    }
  })

  console.log(`已标记 ${extremes.length} 个布林带极值：上轨 ${bollExtremeStats.value.upper}, 下轨 ${bollExtremeStats.value.lower}`)
}

// 切换布林带极值显示
const toggleBollExtremes = () => {
  if (showBollExtremes.value) {
    drawBollExtremes()
  } else {
    clearBollExtremes()
  }
}

// 监听布林带参数变化
watch([bollPeriod, bollStdDev, bollReversionWindow, bollBandFilter, bollPenetrationMode, bollPartialRatio], () => {
  if (showBollExtremes.value) {
    drawBollExtremes()
  }
})

// 数据源配置
const dataSources = {
  daily: {
    data: dailyData,
    label: '日线',
    period: { span: 1, type: 'day' },
    title: '恒生科技指数 日线K线图',
    subtitle: '数据来源：东方财富（2020-07 ~ 2026-02）'
  }
}

const currentSource = ref('daily')
const chartTitle = ref(dataSources.daily.title)
const chartSubtitle = ref(dataSources.daily.subtitle)

// 转换数据格式
const transformData = (data) => {
  return data.map(item => ({
    timestamp: parseInt(item.时间戳),
    open: item.开盘价,
    high: item.最高价,
    low: item.最低价,
    close: item.收盘价,
    volume: item.成交量 || 0
  }))
}

// 清除所有趋势线
const clearTrendLines = () => {
  if (!chart) return
  
  // 移除所有已创建的趋势线overlay
  trendOverlayIds.forEach(id => {
    chart.removeOverlay({ id })
  })
  trendOverlayIds = []
  trendStats.value = null
  console.log('🗑️ 已清除所有趋势线')
}

// 绘制趋势线
const drawTrendLines = () => {
  if (!chart || !currentKlineData.length) return
  
  // 先清除旧的趋势线
  clearTrendLines()
  
  // 识别趋势
  const trends = detectTrends(currentKlineData, {
    minLength: minTrendLength.value,
    sidewaysThreshold: sidewaysThreshold.value
  })
  
  if (trends.length === 0) {
    console.log('⚠️ 未识别到符合条件的趋势')
    return
  }
  
  // 获取统计信息
  trendStats.value = getTrendStats(trends)
  
  // 为每个趋势段创建自定义 overlay（加粗线段 + 转折点圆圈）
  trends.forEach((trend, index) => {
    const color = TREND_COLORS[trend.type]
    
    const overlayId = chart.createOverlay({
      name: 'trendSegment',
      points: [
        { timestamp: trend.startTimestamp, value: trend.startPrice },
        { timestamp: trend.endTimestamp, value: trend.endPrice }
      ],
      extendData: { color },
      lock: true,
      visible: true
    })
    
    if (overlayId) {
      trendOverlayIds.push(overlayId)
    }
  })
  
  console.log(`✅ 已绘制 ${trends.length} 条趋势线：上升 ${trendStats.value.up}, 下降 ${trendStats.value.down}, 横盘 ${trendStats.value.sideways}`)
}

// 切换趋势线显示
const toggleTrendLines = () => {
  if (showTrendLines.value) {
    drawTrendLines()
  } else {
    clearTrendLines()
  }
}

// 监听参数变化，重新绘制趋势线
watch([sidewaysThreshold, minTrendLength], () => {
  if (showTrendLines.value) {
    drawTrendLines()
  }
})

// 切换数据源
const switchDataSource = (sourceKey) => {
  if (!chart || !dataSources[sourceKey]) return

  const source = dataSources[sourceKey]
  currentSource.value = sourceKey
  chartTitle.value = source.title
  chartSubtitle.value = source.subtitle

  // 更新周期
  chart.setPeriod(source.period)

  // 重新加载数据
  chart.setDataLoader({
    getBars: ({ callback }) => {
      const transformedData = transformData(source.data)
      currentKlineData = transformedData  // 缓存数据
      console.log(`✅ 切换到 ${source.label}，加载了 ${transformedData.length} 根K线`)
      callback(transformedData)
      
      // 数据加载完成后，重新绘制开启的标记
      setTimeout(() => {
        if (showTrendLines.value) drawTrendLines()
        if (showGaps.value) drawGaps()
        if (showBollExtremes.value) drawBollExtremes()
      }, 100)
    }
  })
}

onMounted(async () => {
  // 等待 DOM 完全渲染
  await nextTick()

  // 初始化图表
  chart = init('kline-chart')

  // 检查 chart 是否成功初始化
  if (!chart) {
    console.error('图表初始化失败：无法找到 DOM 元素')
    return
  }

  // 1. 设置交易对信息和周期
  chart.setSymbol({
    ticker: 'HSTECH',
    exchange: '恒生科技'
  })

  const initialSource = dataSources[currentSource.value]
  chart.setPeriod(initialSource.period)
  
  // 2. 设置数据加载器
  chart.setDataLoader({
    getBars: ({ callback }) => {
      const transformedData = transformData(initialSource.data)
      currentKlineData = transformedData  // 缓存数据
      console.log(`✅ 加载了 ${transformedData.length} 根K线`)
      console.log('📊 第一条数据:', transformedData[0])
      console.log('📊 最后一条数据:', transformedData[transformedData.length - 1])
      callback(transformedData)
    }
  })
  
  // 3. 配置专业的蜡烛图样式
  chart.setStyles({
    candle: {
      type: 'candle_solid', // 实心蜡烛图
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
  
  // 4. 在主图上添加布林带指标
  chart.createIndicator({
    name: 'BOLL',
    calcParams: [20, 2],  // 周期：20，标准差倍数：2
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
  
  // 5. 创建成交量指标（在独立窗口）
  chart.createIndicator('VOL', false)
  
  // 6. 创建MACD指标（在独立窗口）
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
  
  // 7. 创建RSI指标（在独立窗口）
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
  
  // 8. 设置可见K线数量和间距
  chart.setBarSpace(10)
  chart.setRightMinVisibleBarCount(3)
  chart.setLeftMinVisibleBarCount(3)
  
  // 9. 滚动到最新数据
  setTimeout(() => {
    chart.scrollToRealTime()
  }, 100)
})

onUnmounted(() => {
  // 销毁图表实例
  if (chart) {
    dispose('kline-chart')
  }
})
</script>

<template>
  <div class="kline-container">
    <div class="header">
      <h1>{{ chartTitle }}</h1>
      <p>{{ chartSubtitle }}</p>
      <div class="data-source-selector">
        <button
          v-for="(source, key) in dataSources"
          :key="key"
          :class="['source-btn', { active: currentSource === key }]"
          @click="switchDataSource(key)"
        >
          {{ source.label }}
        </button>
      </div>
      
      <!-- 分析工具按钮 -->
      <div class="analysis-toolbar">
        <button class="settings-btn" @click="showSettingsDialog = true">
          <span class="settings-icon">&#9881;</span>
          分析工具
          <span class="active-count" v-if="showTrendLines || showGaps || showBollExtremes">
            {{ (showTrendLines ? 1 : 0) + (showGaps ? 1 : 0) + (showBollExtremes ? 1 : 0) }}
          </span>
        </button>
        <!-- 激活状态的简要统计 -->
        <div class="active-stats" v-if="showTrendLines && trendStats">
          <span class="mini-stat">趋势 {{ trendStats.total }}段</span>
        </div>
        <div class="active-stats" v-if="showGaps && gapStats">
          <span class="mini-stat">缺口 {{ gapStats.total }}个</span>
        </div>
        <div class="active-stats" v-if="showBollExtremes && bollExtremeStats">
          <span class="mini-stat">极值 {{ bollExtremeStats.total }}个</span>
        </div>
      </div>

    <!-- 分析工具弹出对话框 -->
    <div class="dialog-overlay" v-if="showSettingsDialog" @click.self="showSettingsDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>分析工具设置</h3>
          <button class="dialog-close" @click="showSettingsDialog = false">&times;</button>
        </div>
        <div class="dialog-body">
            <!-- 趋势线 -->
            <div class="dialog-section">
              <div class="section-header">
                <label class="toggle-label">
                  <input
                    type="checkbox"
                    v-model="showTrendLines"
                    @change="toggleTrendLines"
                    class="toggle-checkbox"
                  />
                  <span class="toggle-switch"></span>
                  <span class="toggle-text">显示趋势线</span>
                </label>
              </div>
              <div class="section-content" v-show="showTrendLines">
                <div class="param-row">
                  <label class="slider-label">
                    <span>横盘阈值: {{ sidewaysThreshold.toFixed(1) }}%</span>
                    <input
                      type="range"
                      v-model.number="sidewaysThreshold"
                      min="0.1" max="5" step="0.1"
                      class="slider"
                    />
                  </label>
                  <label class="slider-label">
                    <span>最小K线数: {{ minTrendLength }}</span>
                    <input
                      type="range"
                      v-model.number="minTrendLength"
                      min="2" max="10" step="1"
                      class="slider"
                    />
                  </label>
                </div>
                <div class="trend-stats" v-if="trendStats">
                  <span class="stat-item stat-total">共 {{ trendStats.total }} 段</span>
                  <span class="stat-item stat-up">上升 {{ trendStats.up }}</span>
                  <span class="stat-item stat-down">下降 {{ trendStats.down }}</span>
                  <span class="stat-item stat-sideways">横盘 {{ trendStats.sideways }}</span>
                </div>
              </div>
            </div>

            <!-- 跳空缺口 -->
            <div class="dialog-section">
              <div class="section-header">
                <label class="toggle-label">
                  <input
                    type="checkbox"
                    v-model="showGaps"
                    @change="toggleGaps"
                    class="toggle-checkbox"
                  />
                  <span class="toggle-switch toggle-switch-gap"></span>
                  <span class="toggle-text">跳空缺口</span>
                </label>
              </div>
              <div class="section-content" v-show="showGaps">
                <div class="param-row">
                  <label class="slider-label">
                    <span>最小幅度: {{ gapThreshold.toFixed(1) }}%</span>
                    <input
                      type="range"
                      v-model.number="gapThreshold"
                      min="0.1" max="5" step="0.1"
                      class="slider"
                    />
                  </label>
                </div>
                <div class="trend-stats" v-if="gapStats">
                  <span class="stat-item stat-total">共 {{ gapStats.total }} 个</span>
                  <span class="stat-item stat-up">向上 {{ gapStats.up }}</span>
                  <span class="stat-item stat-down">向下 {{ gapStats.down }}</span>
                </div>
              </div>
            </div>

            <!-- 布林带极值 -->
            <div class="dialog-section">
              <div class="section-header">
                <label class="toggle-label">
                  <input
                    type="checkbox"
                    v-model="showBollExtremes"
                    @change="toggleBollExtremes"
                    class="toggle-checkbox"
                  />
                  <span class="toggle-switch toggle-switch-boll"></span>
                  <span class="toggle-text">布林带极值</span>
                </label>
              </div>
              <div class="section-content" v-show="showBollExtremes">
                <div class="boll-option-row">
                  <span class="boll-option-label">轨道:</span>
                  <div class="boll-btn-group">
                    <button :class="['boll-opt-btn', { active: bollBandFilter === 'both' }]" @click="bollBandFilter = 'both'">双轨</button>
                    <button :class="['boll-opt-btn', { active: bollBandFilter === 'upper' }]" @click="bollBandFilter = 'upper'">上轨</button>
                    <button :class="['boll-opt-btn', { active: bollBandFilter === 'lower' }]" @click="bollBandFilter = 'lower'">下轨</button>
                  </div>
                </div>
                <div class="boll-option-row">
                  <span class="boll-option-label">突破:</span>
                  <div class="boll-btn-group">
                    <button :class="['boll-opt-btn', { active: bollPenetrationMode === 'full' }]" @click="bollPenetrationMode = 'full'">完全突破</button>
                    <button :class="['boll-opt-btn', { active: bollPenetrationMode === 'partial' }]" @click="bollPenetrationMode = 'partial'">部分突破</button>
                  </div>
                </div>
                <div class="param-row" v-show="bollPenetrationMode === 'partial'">
                  <label class="slider-label">
                    <span>穿越比例: {{ bollPartialRatio }}%</span>
                    <input
                      type="range"
                      v-model.number="bollPartialRatio"
                      min="10" max="90" step="5"
                      class="slider"
                    />
                  </label>
                </div>
                <div class="param-row">
                  <label class="slider-label">
                    <span>BOLL周期: {{ bollPeriod }}</span>
                    <input
                      type="range"
                      v-model.number="bollPeriod"
                      min="10" max="50" step="1"
                      class="slider"
                    />
                  </label>
                  <label class="slider-label">
                    <span>标准差: {{ bollStdDev.toFixed(1) }}x</span>
                    <input
                      type="range"
                      v-model.number="bollStdDev"
                      min="1.0" max="4.0" step="0.1"
                      class="slider"
                    />
                  </label>
                  <label class="slider-label">
                    <span>回归窗口: {{ bollReversionWindow }}根</span>
                    <input
                      type="range"
                      v-model.number="bollReversionWindow"
                      min="1" max="20" step="1"
                      class="slider"
                    />
                  </label>
                </div>
                <div class="boll-stats-panel" v-if="bollExtremeStats">
                  <div class="trend-stats">
                    <span class="stat-item stat-total">共 {{ bollExtremeStats.total }} 个</span>
                    <span class="stat-item stat-boll-upper">上轨 {{ bollExtremeStats.upper }}</span>
                    <span class="stat-item stat-boll-lower">下轨 {{ bollExtremeStats.lower }}</span>
                    <span class="stat-item stat-boll-mode">{{ bollPenetrationMode === 'full' ? '完全' : '部分(' + bollPartialRatio + '%)' }}</span>
                  </div>
                  <div class="boll-stats-row">
                    <span class="stat-item stat-boll-pct">占比 {{ bollExtremeStats.percent }}%</span>
                    <span class="stat-item stat-boll-reversion">回归率 {{ bollExtremeStats.reversionRate }}%</span>
                    <span class="stat-item stat-boll-pct">平均回归 {{ bollExtremeStats.avgReversionBars }}根</span>
                    <span class="stat-item stat-boll-pct">最大连续 {{ bollExtremeStats.maxConsecutive }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="kline-chart" ref="chartRef" class="chart"></div>
  </div>
</template>

<style scoped>
.kline-container {
  width: 100%;
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  box-sizing: border-box;
}

.header {
  text-align: center;
  margin-bottom: 20px;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.header h1 {
  color: #333;
  margin: 0 0 10px 0;
  font-size: 28px;
  font-weight: 600;
}

.header p {
  color: #888;
  margin: 0;
  font-size: 14px;
  letter-spacing: 0.5px;
}

.data-source-selector {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 15px;
}

.source-btn {
  padding: 8px 20px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background: #fff;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.source-btn:hover {
  border-color: #999;
  color: #333;
}

.source-btn.active {
  background: #333;
  color: #fff;
  border-color: #333;
}

/* 分析工具按钮栏 */
.analysis-toolbar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
  flex-wrap: wrap;
}

.settings-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background: #fff;
  color: #555;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-btn:hover {
  border-color: #999;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.settings-icon {
  font-size: 16px;
}

.active-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: #22c55e;
  color: #fff;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
}

.active-stats {
  display: flex;
  gap: 6px;
}

.mini-stat {
  padding: 4px 10px;
  background: #f0f0f0;
  border-radius: 12px;
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeInOverlay 0.2s ease;
}

@keyframes fadeInOverlay {
  from { opacity: 0; }
  to { opacity: 1; }
}

.dialog {
  background: #fff;
  border-radius: 16px;
  width: 520px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.25s ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #eee;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.dialog-close {
  width: 32px;
  height: 32px;
  border: none;
  background: #f0f0f0;
  border-radius: 50%;
  font-size: 20px;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.dialog-close:hover {
  background: #e0e0e0;
  color: #333;
}

.dialog-body {
  padding: 16px 24px 24px;
}

.dialog-section {
  padding: 16px 0;
  border-bottom: 1px solid #f0f0f0;
}

.dialog-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section-header {
  margin-bottom: 12px;
}

.section-content {
  padding-left: 54px;
}

.param-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
}

/* Toggle 开关样式 */
.toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.toggle-checkbox {
  display: none;
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background: #ccc;
  border-radius: 12px;
  transition: background 0.3s ease;
  flex-shrink: 0;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-checkbox:checked + .toggle-switch {
  background: #22c55e;
}

.toggle-checkbox:checked + .toggle-switch-gap {
  background: #6366f1;
}

.toggle-checkbox:checked + .toggle-switch-boll {
  background: #a855f7;
}

.toggle-checkbox:checked + .toggle-switch::after {
  transform: translateX(20px);
}

.toggle-text {
  font-size: 14px;
  color: #555;
  font-weight: 500;
}

/* Slider 滑块样式 */
.slider-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.slider-label span {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.slider {
  width: 120px;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #e0e0e0;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #333;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s;
}

.slider::-webkit-slider-thumb:hover {
  background: #555;
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #333;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

/* 趋势统计信息样式 */
.trend-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 12px;
  font-size: 12px;
}

.stat-item {
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.stat-total {
  background: #e0e0e0;
  color: #333;
}

.stat-up {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.stat-down {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.stat-sideways {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.stat-boll-upper {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.stat-boll-lower {
  background: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
}

.stat-boll-pct {
  background: rgba(100, 116, 139, 0.1);
  color: #64748b;
}

.stat-boll-reversion {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.boll-option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.boll-option-label {
  font-size: 12px;
  color: #666;
  min-width: 36px;
  flex-shrink: 0;
}

.boll-btn-group {
  display: flex;
  gap: 4px;
}

.boll-opt-btn {
  padding: 3px 10px;
  border: 1px solid #ddd;
  border-radius: 12px;
  background: #fff;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.boll-opt-btn:hover {
  border-color: #999;
  color: #333;
}

.boll-opt-btn.active {
  background: #a855f7;
  color: #fff;
  border-color: #a855f7;
}

.stat-boll-mode {
  color: #a855f7 !important;
  font-weight: 500;
}

.boll-stats-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.boll-stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 12px;
  background: #f8f9fa;
  border-radius: 12px;
  font-size: 12px;
}

.chart {
  width: 100%;
  height: 700px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid #e0e0e0;
  overflow: hidden;
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

  .header p {
    font-size: 12px;
  }

  .dialog {
    width: 95vw;
    max-height: 85vh;
  }

  .section-content {
    padding-left: 0;
  }

  .param-row {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* 添加加载动画效果 */
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

.kline-container {
  animation: fadeIn 0.6s ease-out;
}
</style>

