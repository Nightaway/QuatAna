/**
 * K线趋势识别工具
 * 用于识别连续K线的上升、下降、横盘趋势
 */

// 趋势类型常量
export const TREND = {
  UP: 'up',           // 上升趋势
  DOWN: 'down',       // 下降趋势
  SIDEWAYS: 'sideways' // 横盘趋势
}

// 趋势颜色配置
export const TREND_COLORS = {
  [TREND.UP]: '#22c55e',      // 绿色 - 上升
  [TREND.DOWN]: '#ef4444',    // 红色 - 下降
  [TREND.SIDEWAYS]: '#f59e0b' // 橙色 - 横盘
}

// 趋势名称（中文）
export const TREND_NAMES = {
  [TREND.UP]: '上升',
  [TREND.DOWN]: '下降',
  [TREND.SIDEWAYS]: '横盘'
}

/**
 * 判断单根K线相对于前一根的趋势方向
 * @param {number} prevClose - 前一根K线收盘价
 * @param {number} currClose - 当前K线收盘价
 * @param {number} sidewaysThreshold - 横盘阈值（百分比）
 * @returns {string} 趋势类型
 */
function getKlineTrend(prevClose, currClose, sidewaysThreshold) {
  const changePercent = ((currClose - prevClose) / prevClose) * 100
  
  if (changePercent > sidewaysThreshold) {
    return TREND.UP
  } else if (changePercent < -sidewaysThreshold) {
    return TREND.DOWN
  } else {
    return TREND.SIDEWAYS
  }
}

/**
 * 识别K线数据中的趋势段落
 * @param {Array} klineData - K线数据数组，每个元素需包含 timestamp, close
 * @param {Object} options - 配置选项
 * @param {number} options.minLength - 最少K线数量才算一个趋势段（默认2）
 * @param {number} options.sidewaysThreshold - 横盘判定阈值百分比（默认1）
 * @returns {Array} 趋势段落数组
 */
export function detectTrends(klineData, options = {}) {
  const { 
    minLength = 2, 
    sidewaysThreshold = 1 
  } = options

  if (!klineData || klineData.length < 2) {
    return []
  }

  const trends = []
  let currentTrend = null
  let startIndex = 0
  
  // 遍历K线，识别趋势变化点
  for (let i = 1; i < klineData.length; i++) {
    const prevKline = klineData[i - 1]
    const currKline = klineData[i]
    
    const trend = getKlineTrend(prevKline.close, currKline.close, sidewaysThreshold)
    
    if (currentTrend === null) {
      // 第一个趋势段开始
      currentTrend = trend
      startIndex = i - 1
    } else if (trend !== currentTrend) {
      // 趋势变化，保存前一个趋势段
      const endIndex = i - 1
      const length = endIndex - startIndex + 1
      
      if (length >= minLength) {
        trends.push({
          type: currentTrend,
          startIndex: startIndex,
          endIndex: endIndex,
          startTimestamp: klineData[startIndex].timestamp,
          endTimestamp: klineData[endIndex].timestamp,
          startPrice: klineData[startIndex].close,
          endPrice: klineData[endIndex].close,
          length: length
        })
      }
      
      // 开始新的趋势段
      currentTrend = trend
      startIndex = i - 1
    }
  }
  
  // 处理最后一个趋势段
  if (currentTrend !== null) {
    const endIndex = klineData.length - 1
    const length = endIndex - startIndex + 1
    
    if (length >= minLength) {
      trends.push({
        type: currentTrend,
        startIndex: startIndex,
        endIndex: endIndex,
        startTimestamp: klineData[startIndex].timestamp,
        endTimestamp: klineData[endIndex].timestamp,
        startPrice: klineData[startIndex].close,
        endPrice: klineData[endIndex].close,
        length: length
      })
    }
  }
  
  return trends
}

/**
 * 合并相邻的相同趋势段（可选功能）
 * @param {Array} trends - 趋势段落数组
 * @param {Array} klineData - 原始K线数据
 * @returns {Array} 合并后的趋势段落数组
 */
export function mergeSameTrends(trends, klineData) {
  if (trends.length < 2) return trends
  
  const merged = []
  let current = { ...trends[0] }
  
  for (let i = 1; i < trends.length; i++) {
    const next = trends[i]
    
    if (next.type === current.type && next.startIndex === current.endIndex + 1) {
      // 合并相邻的相同趋势
      current.endIndex = next.endIndex
      current.endTimestamp = next.endTimestamp
      current.endPrice = next.endPrice
      current.length = current.endIndex - current.startIndex + 1
    } else {
      merged.push(current)
      current = { ...next }
    }
  }
  
  merged.push(current)
  return merged
}

/**
 * 根据K线数据的波动特征，自动计算最优趋势检测参数
 * @param {Array} klineData - K线数据数组，每个元素需包含 timestamp, open, high, low, close, volume
 * @returns {Object} 推荐参数和统计信息
 */
export function computeAdaptiveParams(klineData) {
  if (!klineData || klineData.length < 20) {
    return {
      sidewaysThreshold: 1,
      minTrendLength: 2,
      stats: {
        medianAbsReturn: null,
        meanAbsReturn: null,
        stdReturn: null,
        atrPercent: null,
        dataLength: klineData ? klineData.length : 0
      }
    }
  }

  const dataLength = klineData.length

  // 1. 计算日收益率数组
  const returns = []
  const absReturns = []
  for (let i = 1; i < dataLength; i++) {
    const ret = ((klineData[i].close - klineData[i - 1].close) / klineData[i - 1].close) * 100
    returns.push(ret)
    absReturns.push(Math.abs(ret))
  }

  // 2. 中位数绝对收益率
  const sortedAbsReturns = [...absReturns].sort((a, b) => a - b)
  const mid = Math.floor(sortedAbsReturns.length / 2)
  const medianAbsReturn = sortedAbsReturns.length % 2 === 0
    ? (sortedAbsReturns[mid - 1] + sortedAbsReturns[mid]) / 2
    : sortedAbsReturns[mid]

  // 3. 平均绝对收益率
  const meanAbsReturn = absReturns.reduce((a, b) => a + b, 0) / absReturns.length

  // 4. 收益率标准差
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length
  const stdReturn = Math.sqrt(variance)

  // 5. ATR百分比 (ATR(14) / close 的均值 * 100)
  const atrPeriod = 14
  let atrSum = 0
  let atrCount = 0
  let closeSum = 0
  for (let i = 1; i < dataLength; i++) {
    const tr = Math.max(
      klineData[i].high - klineData[i].low,
      Math.abs(klineData[i].high - klineData[i - 1].close),
      Math.abs(klineData[i].low - klineData[i - 1].close)
    )
    if (i >= atrPeriod) {
      atrSum += tr
      atrCount++
    }
    closeSum += klineData[i].close
  }
  const avgATR = atrCount > 0 ? atrSum / atrCount : 0
  const avgClose = closeSum / (dataLength - 1)
  const atrPercent = avgClose > 0 ? (avgATR / avgClose) * 100 : 0

  // 6. 推导参数
  // sidewaysThreshold: 中位数绝对收益率的一半，四舍五入到0.1
  const sidewaysThreshold = Math.round(medianAbsReturn * 0.5 * 10) / 10

  // minTrendLength: 基于数据量，下限2，上限10
  // 数据量需要超过2000才开始增加最小趋势长度
  const minTrendLength = Math.min(10, Math.max(2, Math.round(dataLength / 1000)))

  return {
    sidewaysThreshold: Math.max(0.1, sidewaysThreshold), // 至少0.1%
    minTrendLength,
    stats: {
      medianAbsReturn: Math.round(medianAbsReturn * 1000) / 1000,
      meanAbsReturn: Math.round(meanAbsReturn * 1000) / 1000,
      stdReturn: Math.round(stdReturn * 1000) / 1000,
      atrPercent: Math.round(atrPercent * 1000) / 1000,
      dataLength
    }
  }
}

/**
 * 获取趋势统计信息
 * @param {Array} trends - 趋势段落数组
 * @returns {Object} 统计信息
 */
export function getTrendStats(trends) {
  const stats = {
    total: trends.length,
    up: 0,
    down: 0,
    sideways: 0,
    avgLength: 0
  }
  
  if (trends.length === 0) return stats
  
  let totalLength = 0
  
  trends.forEach(trend => {
    totalLength += trend.length
    
    switch (trend.type) {
      case TREND.UP:
        stats.up++
        break
      case TREND.DOWN:
        stats.down++
        break
      case TREND.SIDEWAYS:
        stats.sideways++
        break
    }
  })
  
  stats.avgLength = Math.round(totalLength / trends.length * 10) / 10
  
  return stats
}
