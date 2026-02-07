/**
 * MA 均线交叉策略
 * Moving Average Crossover Strategy
 */

import { calculateSMA, calculateEMA } from '../indicators.js'

/**
 * 策略默认参数
 */
export const defaultParams = {
  fastPeriod: 5,
  slowPeriod: 20,
  maType: 'SMA' // 'SMA' 或 'EMA'
}

/**
 * 策略参数配置（用于 UI 显示）
 */
export const paramConfig = [
  { key: 'fastPeriod', label: '快线周期', type: 'number', min: 2, max: 50, default: 5 },
  { key: 'slowPeriod', label: '慢线周期', type: 'number', min: 5, max: 200, default: 20 },
  { key: 'maType', label: '均线类型', type: 'select', options: ['SMA', 'EMA'], default: 'SMA' }
]

/**
 * 策略名称
 */
export const name = 'MA均线交叉'

/**
 * 策略描述
 */
export const description = '快线上穿慢线买入，快线下穿慢线卖出'

/**
 * 生成交易信号
 * @param {Array} data - K线数据数组
 * @param {Object} params - 策略参数
 * @returns {Array} 信号数组，每个元素为 { index, signal, reason }
 */
export function generateSignals(data, params = {}) {
  const { fastPeriod, slowPeriod, maType } = { ...defaultParams, ...params }

  // 计算均线
  const calculateMA = maType === 'EMA' ? calculateEMA : calculateSMA
  const fastMA = calculateMA(data, fastPeriod)
  const slowMA = calculateMA(data, slowPeriod)

  const signals = []

  for (let i = 1; i < data.length; i++) {
    // 跳过无效数据
    if (fastMA[i] === null || slowMA[i] === null ||
        fastMA[i - 1] === null || slowMA[i - 1] === null) {
      continue
    }

    const prevFastAboveSlow = fastMA[i - 1] > slowMA[i - 1]
    const currFastAboveSlow = fastMA[i] > slowMA[i]

    // 金叉：快线从下方穿越慢线
    if (!prevFastAboveSlow && currFastAboveSlow) {
      signals.push({
        index: i,
        timestamp: data[i].timestamp,
        signal: 'BUY',
        reason: `${maType}${fastPeriod}上穿${maType}${slowPeriod}（金叉）`,
        price: data[i].close,
        indicators: {
          fastMA: fastMA[i],
          slowMA: slowMA[i]
        }
      })
    }

    // 死叉：快线从上方穿越慢线
    if (prevFastAboveSlow && !currFastAboveSlow) {
      signals.push({
        index: i,
        timestamp: data[i].timestamp,
        signal: 'SELL',
        reason: `${maType}${fastPeriod}下穿${maType}${slowPeriod}（死叉）`,
        price: data[i].close,
        indicators: {
          fastMA: fastMA[i],
          slowMA: slowMA[i]
        }
      })
    }
  }

  return signals
}
