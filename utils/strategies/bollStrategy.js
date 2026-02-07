/**
 * 布林带策略
 * Bollinger Bands Strategy
 */

import { calculateBOLL } from '../indicators.js'

/**
 * 策略默认参数
 */
export const defaultParams = {
  period: 20,
  stdDev: 2,
  mode: 'reversion' // 'reversion' 回归模式 或 'breakout' 突破模式
}

/**
 * 策略参数配置（用于 UI 显示）
 */
export const paramConfig = [
  { key: 'period', label: '周期', type: 'number', min: 5, max: 50, default: 20 },
  { key: 'stdDev', label: '标准差倍数', type: 'number', min: 1, max: 4, step: 0.5, default: 2 },
  { key: 'mode', label: '策略模式', type: 'select', options: ['reversion', 'breakout'], labels: ['回归模式', '突破模式'], default: 'reversion' }
]

/**
 * 策略名称
 */
export const name = '布林带策略'

/**
 * 策略描述
 */
export const description = '回归模式：触及下轨买入，触及上轨卖出；突破模式：突破上轨买入，跌破下轨卖出'

/**
 * 生成交易信号
 * @param {Array} data - K线数据数组
 * @param {Object} params - 策略参数
 * @returns {Array} 信号数组
 */
export function generateSignals(data, params = {}) {
  const { period, stdDev, mode } = { ...defaultParams, ...params }

  const boll = calculateBOLL(data, period, stdDev)
  const signals = []

  for (let i = 1; i < data.length; i++) {
    if (boll.upper[i] === null || boll.lower[i] === null ||
        boll.upper[i - 1] === null || boll.lower[i - 1] === null) {
      continue
    }

    const prevClose = data[i - 1].close
    const currClose = data[i].close
    const currLow = data[i].low
    const currHigh = data[i].high

    if (mode === 'reversion') {
      // 回归模式：价格触及下轨后反弹买入
      if (currLow <= boll.lower[i] && currClose > boll.lower[i]) {
        signals.push({
          index: i,
          timestamp: data[i].timestamp,
          signal: 'BUY',
          reason: `价格触及布林下轨(${boll.lower[i].toFixed(2)})后反弹`,
          price: data[i].close,
          indicators: {
            upper: boll.upper[i],
            middle: boll.middle[i],
            lower: boll.lower[i]
          }
        })
      }

      // 回归模式：价格触及上轨后回落卖出
      if (currHigh >= boll.upper[i] && currClose < boll.upper[i]) {
        signals.push({
          index: i,
          timestamp: data[i].timestamp,
          signal: 'SELL',
          reason: `价格触及布林上轨(${boll.upper[i].toFixed(2)})后回落`,
          price: data[i].close,
          indicators: {
            upper: boll.upper[i],
            middle: boll.middle[i],
            lower: boll.lower[i]
          }
        })
      }
    } else {
      // 突破模式：价格突破上轨买入
      if (prevClose <= boll.upper[i - 1] && currClose > boll.upper[i]) {
        signals.push({
          index: i,
          timestamp: data[i].timestamp,
          signal: 'BUY',
          reason: `价格突破布林上轨(${boll.upper[i].toFixed(2)})`,
          price: data[i].close,
          indicators: {
            upper: boll.upper[i],
            middle: boll.middle[i],
            lower: boll.lower[i]
          }
        })
      }

      // 突破模式：价格跌破下轨卖出
      if (prevClose >= boll.lower[i - 1] && currClose < boll.lower[i]) {
        signals.push({
          index: i,
          timestamp: data[i].timestamp,
          signal: 'SELL',
          reason: `价格跌破布林下轨(${boll.lower[i].toFixed(2)})`,
          price: data[i].close,
          indicators: {
            upper: boll.upper[i],
            middle: boll.middle[i],
            lower: boll.lower[i]
          }
        })
      }
    }
  }

  return signals
}
