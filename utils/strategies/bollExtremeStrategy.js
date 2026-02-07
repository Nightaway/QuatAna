/**
 * 布林带极值回归策略
 * Bollinger Bands Extreme Reversion Strategy
 *
 * 当K线实体完全穿透布林带上轨时做空，完全穿透下轨时做多，
 * 价格回归到20日均线（布林带中轨）时平仓。
 */

import { calculateBOLL } from '../indicators.js'

/**
 * 策略默认参数
 */
export const defaultParams = {
  period: 20,
  stdDev: 2
}

/**
 * 策略参数配置（用于 UI 显示）
 */
export const paramConfig = [
  { key: 'period', label: 'BOLL周期', type: 'number', min: 10, max: 50, default: 20 },
  { key: 'stdDev', label: '标准差倍数', type: 'number', min: 1, max: 4, step: 0.1, default: 2 }
]

/**
 * 策略名称
 */
export const name = '布林带极值回归'

/**
 * 策略描述
 */
export const description = '实体完全穿透上轨做空、穿透下轨做多，回归中轨平仓'

/**
 * 生成交易信号
 * @param {Array} data - K线数据数组
 * @param {Object} params - 策略参数
 * @returns {Array} 信号数组
 */
export function generateSignals(data, params = {}) {
  const { period, stdDev } = { ...defaultParams, ...params }

  const boll = calculateBOLL(data, period, stdDev)
  const signals = []
  let inPosition = 'none' // 'none' | 'long' | 'short'

  for (let i = 1; i < data.length; i++) {
    if (boll.upper[i] === null || boll.lower[i] === null) {
      continue
    }

    const { open, close } = data[i]
    const upper = boll.upper[i]
    const lower = boll.lower[i]
    const middle = boll.middle[i]

    if (inPosition === 'none') {
      // 做多：实体完全在下轨之下
      if (Math.max(open, close) < lower) {
        signals.push({
          index: i,
          timestamp: data[i].timestamp,
          signal: 'BUY',
          reason: `实体穿透布林下轨(${lower.toFixed(2)})，做多`,
          price: close,
          indicators: { upper, middle, lower }
        })
        inPosition = 'long'
      }
      // 做空：实体完全在上轨之上
      else if (Math.min(open, close) > upper) {
        signals.push({
          index: i,
          timestamp: data[i].timestamp,
          signal: 'SELL',
          reason: `实体穿透布林上轨(${upper.toFixed(2)})，做空`,
          price: close,
          indicators: { upper, middle, lower }
        })
        inPosition = 'short'
      }
    } else if (inPosition === 'long') {
      // 平多：收盘价回归中轨
      if (close >= middle) {
        signals.push({
          index: i,
          timestamp: data[i].timestamp,
          signal: 'SELL',
          reason: `价格回归中轨(${middle.toFixed(2)})，平多`,
          price: close,
          indicators: { upper, middle, lower }
        })
        inPosition = 'none'
      }
    } else if (inPosition === 'short') {
      // 平空：收盘价回归中轨
      if (close <= middle) {
        signals.push({
          index: i,
          timestamp: data[i].timestamp,
          signal: 'BUY',
          reason: `价格回归中轨(${middle.toFixed(2)})，平空`,
          price: close,
          indicators: { upper, middle, lower }
        })
        inPosition = 'none'
      }
    }
  }

  return signals
}
