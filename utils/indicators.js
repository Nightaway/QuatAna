/**
 * 技术指标计算模块
 * Technical Indicators Calculation Module
 */

/**
 * 计算简单移动平均线 (SMA)
 * @param {Array} data - K线数据数组，每个元素需包含 close 字段
 * @param {number} period - 周期
 * @returns {Array} SMA 值数组，前 period-1 个值为 null
 */
export function calculateSMA(data, period) {
  const result = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else {
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close
      }
      result.push(sum / period)
    }
  }
  return result
}

/**
 * 计算指数移动平均线 (EMA)
 * @param {Array} data - K线数据数组，每个元素需包含 close 字段
 * @param {number} period - 周期
 * @returns {Array} EMA 值数组
 */
export function calculateEMA(data, period) {
  const result = []
  const multiplier = 2 / (period + 1)

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else if (i === period - 1) {
      // 第一个 EMA 值使用 SMA
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close
      }
      result.push(sum / period)
    } else {
      const ema = (data[i].close - result[i - 1]) * multiplier + result[i - 1]
      result.push(ema)
    }
  }
  return result
}

/**
 * 计算相对强弱指数 (RSI)
 * @param {Array} data - K线数据数组，每个元素需包含 close 字段
 * @param {number} period - 周期，默认 14
 * @returns {Array} RSI 值数组
 */
export function calculateRSI(data, period = 14) {
  const result = []
  const gains = []
  const losses = []

  // 计算价格变化
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      gains.push(0)
      losses.push(0)
    } else {
      const change = data[i].close - data[i - 1].close
      gains.push(change > 0 ? change : 0)
      losses.push(change < 0 ? -change : 0)
    }
  }

  // 计算 RSI
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null)
    } else if (i === period) {
      // 第一个 RSI 使用简单平均
      let avgGain = 0
      let avgLoss = 0
      for (let j = 1; j <= period; j++) {
        avgGain += gains[i - period + j]
        avgLoss += losses[i - period + j]
      }
      avgGain /= period
      avgLoss /= period

      if (avgLoss === 0) {
        result.push(100)
      } else {
        const rs = avgGain / avgLoss
        result.push(100 - (100 / (1 + rs)))
      }
    } else {
      // 使用平滑平均
      const prevRSI = result[i - 1]
      if (prevRSI === null) {
        result.push(null)
        continue
      }

      // 反推前一个 avgGain 和 avgLoss
      let avgGain = 0
      let avgLoss = 0
      for (let j = 0; j < period; j++) {
        avgGain += gains[i - j]
        avgLoss += losses[i - j]
      }
      avgGain /= period
      avgLoss /= period

      if (avgLoss === 0) {
        result.push(100)
      } else {
        const rs = avgGain / avgLoss
        result.push(100 - (100 / (1 + rs)))
      }
    }
  }
  return result
}

/**
 * 计算布林带 (BOLL)
 * @param {Array} data - K线数据数组，每个元素需包含 close 字段
 * @param {number} period - 周期，默认 20
 * @param {number} stdDev - 标准差倍数，默认 2
 * @returns {Object} 包含 upper, middle, lower 数组
 */
export function calculateBOLL(data, period = 20, stdDev = 2) {
  const middle = calculateSMA(data, period)
  const upper = []
  const lower = []

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null)
      lower.push(null)
    } else {
      // 计算标准差
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += Math.pow(data[i - j].close - middle[i], 2)
      }
      const std = Math.sqrt(sum / period)

      upper.push(middle[i] + stdDev * std)
      lower.push(middle[i] - stdDev * std)
    }
  }

  return { upper, middle, lower }
}

/**
 * 计算 MACD
 * @param {Array} data - K线数据数组，每个元素需包含 close 字段
 * @param {number} fastPeriod - 快线周期，默认 12
 * @param {number} slowPeriod - 慢线周期，默认 26
 * @param {number} signalPeriod - 信号线周期，默认 9
 * @returns {Object} 包含 macd, signal, histogram 数组
 */
export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calculateEMA(data, fastPeriod)
  const slowEMA = calculateEMA(data, slowPeriod)

  // 计算 MACD 线 (DIF)
  const macdLine = []
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null)
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i])
    }
  }

  // 计算信号线 (DEA) - MACD 线的 EMA
  const signalLine = []
  const multiplier = 2 / (signalPeriod + 1)
  let firstValidIndex = -1

  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null)
      continue
    }

    if (firstValidIndex === -1) {
      firstValidIndex = i
    }

    const validCount = i - firstValidIndex

    if (validCount < signalPeriod - 1) {
      signalLine.push(null)
    } else if (validCount === signalPeriod - 1) {
      // 第一个信号线值使用 SMA
      let sum = 0
      for (let j = 0; j < signalPeriod; j++) {
        sum += macdLine[i - j]
      }
      signalLine.push(sum / signalPeriod)
    } else {
      const signal = (macdLine[i] - signalLine[i - 1]) * multiplier + signalLine[i - 1]
      signalLine.push(signal)
    }
  }

  // 计算柱状图 (MACD Histogram)
  const histogram = []
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null)
    } else {
      histogram.push((macdLine[i] - signalLine[i]) * 2) // 乘以2是常见的显示方式
    }
  }

  return {
    macd: macdLine,      // DIF
    signal: signalLine,  // DEA
    histogram            // MACD 柱
  }
}
