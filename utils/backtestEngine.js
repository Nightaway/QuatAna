/**
 * 回测引擎
 * Backtest Engine - 支持做多和做空
 */

import * as maStrategy from './strategies/maStrategy.js'
import * as rsiStrategy from './strategies/rsiStrategy.js'
import * as bollStrategy from './strategies/bollStrategy.js'
import * as macdStrategy from './strategies/macdStrategy.js'
import * as bollExtremeStrategy from './strategies/bollExtremeStrategy.js'

/**
 * 可用策略列表
 */
export const strategies = {
  ma: maStrategy,
  rsi: rsiStrategy,
  boll: bollStrategy,
  macd: macdStrategy,
  bollExtreme: bollExtremeStrategy
}

/**
 * 默认回测配置
 */
export const defaultConfig = {
  initialCapital: 100000,    // 初始资金
  positionSize: 1,           // 仓位比例 (0-1)
  commission: 0.001,         // 手续费率 (0.1%)
  slippage: 0.0005,          // 滑点 (0.05%)
  allowShort: false          // 是否允许做空
}

/**
 * 持仓状态
 */
const Position = {
  NONE: 'NONE',
  LONG: 'LONG',
  SHORT: 'SHORT'
}

/**
 * 运行回测
 * @param {Array} data - K线数据
 * @param {string} strategyName - 策略名称
 * @param {Object} strategyParams - 策略参数
 * @param {Object} config - 回测配置
 * @returns {Object} 回测结果
 */
export function runBacktest(data, strategyName, strategyParams = {}, config = {}) {
  const strategy = strategies[strategyName]
  if (!strategy) {
    throw new Error(`未知策略: ${strategyName}`)
  }

  const cfg = { ...defaultConfig, ...config }
  const signals = strategy.generateSignals(data, strategyParams)

  return executeBacktest(data, signals, cfg)
}

/**
 * 执行回测逻辑
 * @param {Array} data - K线数据
 * @param {Array} signals - 交易信号
 * @param {Object} config - 回测配置
 * @returns {Object} 回测结果
 */
function executeBacktest(data, signals, config) {
  const {
    initialCapital,
    positionSize,
    commission,
    slippage,
    allowShort
  } = config

  let cash = initialCapital
  let position = Position.NONE
  let positionQty = 0
  let entryPrice = 0
  let entryTimestamp = 0

  const trades = []
  const equityCurve = []
  let tradeId = 0

  // 创建信号索引映射
  const signalMap = new Map()
  signals.forEach(s => {
    if (!signalMap.has(s.index)) {
      signalMap.set(s.index, s)
    }
  })

  // 遍历每根K线
  for (let i = 0; i < data.length; i++) {
    const bar = data[i]
    const signal = signalMap.get(i)

    // 计算当前权益
    let equity = cash
    if (position === Position.LONG) {
      equity += positionQty * bar.close
    } else if (position === Position.SHORT) {
      // 做空：盈亏 = (开仓价 - 当前价) * 数量
      equity += positionQty * (2 * entryPrice - bar.close)
    }

    equityCurve.push({
      timestamp: bar.timestamp,
      equity: equity,
      price: bar.close
    })

    if (!signal) continue

    // 处理交易信号
    if (signal.signal === 'BUY') {
      if (position === Position.NONE) {
        // 开多仓
        const execPrice = bar.close * (1 + slippage)
        const availableCash = cash * positionSize
        const fee = availableCash * commission
        const qty = (availableCash - fee) / execPrice

        cash -= availableCash
        positionQty = qty
        position = Position.LONG
        entryPrice = execPrice
        entryTimestamp = bar.timestamp

        trades.push({
          id: ++tradeId,
          type: 'BUY',
          action: 'OPEN_LONG',
          timestamp: bar.timestamp,
          price: execPrice,
          quantity: qty,
          fee: fee,
          signal: signal.reason,
          pnl: 0,
          pnlPercent: 0
        })
      } else if (position === Position.SHORT) {
        // 平空仓
        const execPrice = bar.close * (1 + slippage)
        const value = positionQty * execPrice
        const fee = value * commission
        const pnl = positionQty * (entryPrice - execPrice) - fee

        cash += positionQty * entryPrice + pnl
        const pnlPercent = (pnl / (positionQty * entryPrice)) * 100

        trades.push({
          id: ++tradeId,
          type: 'BUY',
          action: 'CLOSE_SHORT',
          timestamp: bar.timestamp,
          price: execPrice,
          quantity: positionQty,
          fee: fee,
          signal: signal.reason,
          pnl: pnl,
          pnlPercent: pnlPercent,
          holdingPeriod: bar.timestamp - entryTimestamp
        })

        position = Position.NONE
        positionQty = 0
        entryPrice = 0
      }
    } else if (signal.signal === 'SELL') {
      if (position === Position.LONG) {
        // 平多仓
        const execPrice = bar.close * (1 - slippage)
        const value = positionQty * execPrice
        const fee = value * commission
        const pnl = value - fee - (positionQty * entryPrice)

        cash += value - fee
        const pnlPercent = (pnl / (positionQty * entryPrice)) * 100

        trades.push({
          id: ++tradeId,
          type: 'SELL',
          action: 'CLOSE_LONG',
          timestamp: bar.timestamp,
          price: execPrice,
          quantity: positionQty,
          fee: fee,
          signal: signal.reason,
          pnl: pnl,
          pnlPercent: pnlPercent,
          holdingPeriod: bar.timestamp - entryTimestamp
        })

        position = Position.NONE
        positionQty = 0
        entryPrice = 0
      } else if (position === Position.NONE && allowShort) {
        // 开空仓
        const execPrice = bar.close * (1 - slippage)
        const availableCash = cash * positionSize
        const fee = availableCash * commission
        const qty = (availableCash - fee) / execPrice

        cash -= fee // 只扣手续费，保证金暂不考虑
        positionQty = qty
        position = Position.SHORT
        entryPrice = execPrice
        entryTimestamp = bar.timestamp

        trades.push({
          id: ++tradeId,
          type: 'SELL',
          action: 'OPEN_SHORT',
          timestamp: bar.timestamp,
          price: execPrice,
          quantity: qty,
          fee: fee,
          signal: signal.reason,
          pnl: 0,
          pnlPercent: 0
        })
      }
    }
  }

  // 如果还有持仓，按最后价格平仓
  if (position !== Position.NONE && data.length > 0) {
    const lastBar = data[data.length - 1]
    if (position === Position.LONG) {
      const execPrice = lastBar.close
      const value = positionQty * execPrice
      const fee = value * commission
      const pnl = value - fee - (positionQty * entryPrice)

      cash += value - fee

      trades.push({
        id: ++tradeId,
        type: 'SELL',
        action: 'CLOSE_LONG',
        timestamp: lastBar.timestamp,
        price: execPrice,
        quantity: positionQty,
        fee: fee,
        signal: '回测结束平仓',
        pnl: pnl,
        pnlPercent: (pnl / (positionQty * entryPrice)) * 100,
        holdingPeriod: lastBar.timestamp - entryTimestamp
      })
    } else if (position === Position.SHORT) {
      const execPrice = lastBar.close
      const pnl = positionQty * (entryPrice - execPrice) - (positionQty * execPrice * commission)

      cash += positionQty * entryPrice + pnl

      trades.push({
        id: ++tradeId,
        type: 'BUY',
        action: 'CLOSE_SHORT',
        timestamp: lastBar.timestamp,
        price: execPrice,
        quantity: positionQty,
        fee: positionQty * execPrice * commission,
        signal: '回测结束平仓',
        pnl: pnl,
        pnlPercent: (pnl / (positionQty * entryPrice)) * 100,
        holdingPeriod: lastBar.timestamp - entryTimestamp
      })
    }

    // 更新最后的权益
    if (equityCurve.length > 0) {
      equityCurve[equityCurve.length - 1].equity = cash
    }
  }

  return {
    initialCapital,
    finalCapital: cash,
    trades,
    equityCurve,
    config
  }
}

/**
 * 获取策略列表
 * @returns {Array} 策略信息数组
 */
export function getStrategyList() {
  return Object.entries(strategies).map(([key, strategy]) => ({
    key,
    name: strategy.name,
    description: strategy.description,
    paramConfig: strategy.paramConfig,
    defaultParams: strategy.defaultParams
  }))
}

/**
 * 获取策略参数配置
 * @param {string} strategyName - 策略名称
 * @returns {Object} 参数配置
 */
export function getStrategyParams(strategyName) {
  const strategy = strategies[strategyName]
  if (!strategy) return null

  return {
    paramConfig: strategy.paramConfig,
    defaultParams: strategy.defaultParams
  }
}
