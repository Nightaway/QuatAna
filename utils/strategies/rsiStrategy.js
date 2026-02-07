/**
 * RSI 超买超卖策略
 * RSI Overbought/Oversold Strategy
 */

import { calculateRSI } from '../indicators.js'

/**
 * 策略默认参数
 */
export const defaultParams = {
  period: 14,
  overbought: 70,
  oversold: 30
}

/**
 * 策略参数配置（用于 UI 显示）
 */
export const paramConfig = [
  { key: 'period', label: 'RSI周期', type: 'number', min: 2, max: 50, default: 14 },
  { key: 'overbought', label: '超买线', type: 'number', min: 50, max: 95, default: 70 },
  { key: 'oversold', label: '超卖线', type: 'number', min: 5, max: 50, default: 30 }
]

/**
 * 策略名称
 */
export const name = 'RSI超买超卖'

/**
 * 策略描述
 */
export const description = 'RSI上穿超卖线买入，RSI下穿超买线卖出'

/**
 * 生成交易信号
 * @param {Array} data - K线数据数组
 * @param {Object} params - 策略参数
 * @returns {Array} 信号数组
 */
export function generateSignals(data, params = {}) {
  const { period, overbought, oversold } = { ...defaultParams, ...params }

  const rsi = calculateRSI(data, period)
  const signals = []

  for (let i = 1; i < data.length; i++) {
    if (rsi[i] === null || rsi[i - 1] === null) {
      continue
    }

    // RSI 从下方穿越超卖线 → 买入信号
    if (rsi[i - 1] < oversold && rsi[i] >= oversold) {
      signals.push({
        index: i,
        timestamp: data[i].timestamp,
        signal: 'BUY',
        reason: `RSI(${period})上穿超卖线${oversold}`,
        price: data[i].close,
        indicators: {
          rsi: rsi[i]
        }
      })
    }

    // RSI 从上方穿越超买线 → 卖出信号
    if (rsi[i - 1] > overbought && rsi[i] <= overbought) {
      signals.push({
        index: i,
        timestamp: data[i].timestamp,
        signal: 'SELL',
        reason: `RSI(${period})下穿超买线${overbought}`,
        price: data[i].close,
        indicators: {
          rsi: rsi[i]
        }
      })
    }
  }

  return signals
}
