/**
 * MACD 策略
 * MACD Crossover Strategy
 */

import { calculateMACD } from '../indicators.js'

/**
 * 策略默认参数
 */
export const defaultParams = {
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9
}

/**
 * 策略参数配置（用于 UI 显示）
 */
export const paramConfig = [
  { key: 'fastPeriod', label: '快线周期', type: 'number', min: 2, max: 50, default: 12 },
  { key: 'slowPeriod', label: '慢线周期', type: 'number', min: 10, max: 100, default: 26 },
  { key: 'signalPeriod', label: '信号线周期', type: 'number', min: 2, max: 50, default: 9 }
]

/**
 * 策略名称
 */
export const name = 'MACD金叉死叉'

/**
 * 策略描述
 */
export const description = 'MACD线上穿信号线（金叉）买入，MACD线下穿信号线（死叉）卖出'

/**
 * 生成交易信号
 * @param {Array} data - K线数据数组
 * @param {Object} params - 策略参数
 * @returns {Array} 信号数组
 */
export function generateSignals(data, params = {}) {
  const { fastPeriod, slowPeriod, signalPeriod } = { ...defaultParams, ...params }

  const { macd, signal } = calculateMACD(data, fastPeriod, slowPeriod, signalPeriod)
  const signals = []

  for (let i = 1; i < data.length; i++) {
    if (macd[i] === null || signal[i] === null ||
        macd[i - 1] === null || signal[i - 1] === null) {
      continue
    }

    const prevMacdAboveSignal = macd[i - 1] > signal[i - 1]
    const currMacdAboveSignal = macd[i] > signal[i]

    // 金叉：MACD 线从下方穿越信号线
    if (!prevMacdAboveSignal && currMacdAboveSignal) {
      signals.push({
        index: i,
        timestamp: data[i].timestamp,
        signal: 'BUY',
        reason: `MACD(${fastPeriod},${slowPeriod},${signalPeriod})金叉`,
        price: data[i].close,
        indicators: {
          macd: macd[i],
          signal: signal[i]
        }
      })
    }

    // 死叉：MACD 线从上方穿越信号线
    if (prevMacdAboveSignal && !currMacdAboveSignal) {
      signals.push({
        index: i,
        timestamp: data[i].timestamp,
        signal: 'SELL',
        reason: `MACD(${fastPeriod},${slowPeriod},${signalPeriod})死叉`,
        price: data[i].close,
        indicators: {
          macd: macd[i],
          signal: signal[i]
        }
      })
    }
  }

  return signals
}
