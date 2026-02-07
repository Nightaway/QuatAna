/**
 * 绩效指标计算模块
 * Performance Metrics Module
 */

/**
 * 计算完整的绩效指标
 * @param {Object} backtestResult - 回测结果
 * @returns {Object} 绩效指标
 */
export function calculateMetrics(backtestResult) {
  const { initialCapital, finalCapital, trades, equityCurve } = backtestResult

  // 筛选出平仓交易（有盈亏的交易）
  const closedTrades = trades.filter(t => t.pnl !== 0)

  // 基础指标
  const totalReturn = finalCapital - initialCapital
  const totalReturnPercent = (totalReturn / initialCapital) * 100

  // 交易统计
  const totalTrades = closedTrades.length
  const winningTrades = closedTrades.filter(t => t.pnl > 0)
  const losingTrades = closedTrades.filter(t => t.pnl < 0)

  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0

  // 盈亏统计
  const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0)
  const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0))

  const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0
  const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0

  // 盈亏比
  const profitLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0

  // 利润因子
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0

  // 最大回撤
  const { maxDrawdown, maxDrawdownPercent, drawdownCurve } = calculateDrawdown(equityCurve)

  // 夏普比率
  const sharpeRatio = calculateSharpeRatio(equityCurve, initialCapital)

  // 最大连续盈利/亏损
  const { maxConsecutiveWins, maxConsecutiveLosses } = calculateConsecutive(closedTrades)

  // 平均持仓时间
  const avgHoldingPeriod = calculateAvgHoldingPeriod(closedTrades)

  return {
    // 收益指标
    totalReturn,
    totalReturnPercent,
    finalCapital,

    // 交易统计
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,

    // 盈亏分析
    totalProfit,
    totalLoss,
    avgWin,
    avgLoss,
    profitLossRatio,
    profitFactor,

    // 风险指标
    maxDrawdown,
    maxDrawdownPercent,
    sharpeRatio,

    // 连续统计
    maxConsecutiveWins,
    maxConsecutiveLosses,

    // 时间统计
    avgHoldingPeriod,

    // 曲线数据
    equityCurve,
    drawdownCurve
  }
}

/**
 * 计算最大回撤
 * @param {Array} equityCurve - 权益曲线
 * @returns {Object} 回撤信息
 */
function calculateDrawdown(equityCurve) {
  if (!equityCurve || equityCurve.length === 0) {
    return { maxDrawdown: 0, maxDrawdownPercent: 0, drawdownCurve: [] }
  }

  let peak = equityCurve[0].equity
  let maxDrawdown = 0
  let maxDrawdownPercent = 0
  const drawdownCurve = []

  for (const point of equityCurve) {
    if (point.equity > peak) {
      peak = point.equity
    }

    const drawdown = peak - point.equity
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
      maxDrawdownPercent = drawdownPercent
    }

    drawdownCurve.push({
      timestamp: point.timestamp,
      drawdown,
      drawdownPercent
    })
  }

  return { maxDrawdown, maxDrawdownPercent, drawdownCurve }
}

/**
 * 计算夏普比率
 * @param {Array} equityCurve - 权益曲线
 * @param {number} initialCapital - 初始资金
 * @param {number} riskFreeRate - 无风险利率（年化），默认 3%
 * @returns {number} 夏普比率
 */
function calculateSharpeRatio(equityCurve, initialCapital, riskFreeRate = 0.03) {
  if (!equityCurve || equityCurve.length < 2) {
    return 0
  }

  // 计算每期收益率
  const returns = []
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEquity = equityCurve[i - 1].equity
    const currEquity = equityCurve[i].equity
    if (prevEquity > 0) {
      returns.push((currEquity - prevEquity) / prevEquity)
    }
  }

  if (returns.length === 0) {
    return 0
  }

  // 计算平均收益率
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length

  // 计算收益率标准差
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) {
    return 0
  }

  // 假设数据是日线，年化因子为 252
  const annualFactor = Math.sqrt(252)
  const dailyRiskFreeRate = riskFreeRate / 252

  // 夏普比率 = (平均收益率 - 无风险利率) / 标准差 * 年化因子
  const sharpe = ((avgReturn - dailyRiskFreeRate) / stdDev) * annualFactor

  return sharpe
}

/**
 * 计算最大连续盈利/亏损次数
 * @param {Array} trades - 交易记录
 * @returns {Object} 连续统计
 */
function calculateConsecutive(trades) {
  let maxConsecutiveWins = 0
  let maxConsecutiveLosses = 0
  let currentWins = 0
  let currentLosses = 0

  for (const trade of trades) {
    if (trade.pnl > 0) {
      currentWins++
      currentLosses = 0
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins)
    } else if (trade.pnl < 0) {
      currentLosses++
      currentWins = 0
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses)
    }
  }

  return { maxConsecutiveWins, maxConsecutiveLosses }
}

/**
 * 计算平均持仓时间
 * @param {Array} trades - 交易记录
 * @returns {string} 平均持仓时间描述
 */
function calculateAvgHoldingPeriod(trades) {
  const tradesWithHolding = trades.filter(t => t.holdingPeriod)
  if (tradesWithHolding.length === 0) {
    return '-'
  }

  const avgMs = tradesWithHolding.reduce((sum, t) => sum + t.holdingPeriod, 0) / tradesWithHolding.length

  // 转换为可读格式
  const hours = avgMs / (1000 * 60 * 60)
  if (hours < 24) {
    return `${hours.toFixed(1)} 小时`
  }

  const days = hours / 24
  return `${days.toFixed(1)} 天`
}

/**
 * 格式化数字显示
 * @param {number} value - 数值
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的字符串
 */
export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return '-'
  }
  if (!isFinite(value)) {
    return value > 0 ? '∞' : '-∞'
  }
  return value.toFixed(decimals)
}

/**
 * 格式化百分比显示
 * @param {number} value - 百分比值
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的字符串
 */
export function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return '-'
  }
  if (!isFinite(value)) {
    return value > 0 ? '∞%' : '-∞%'
  }
  return value.toFixed(decimals) + '%'
}

/**
 * 格式化货币显示
 * @param {number} value - 金额
 * @param {string} currency - 货币符号
 * @returns {string} 格式化后的字符串
 */
export function formatCurrency(value, currency = '¥') {
  if (value === null || value === undefined || isNaN(value)) {
    return '-'
  }
  const formatted = Math.abs(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return value < 0 ? `-${currency}${formatted}` : `${currency}${formatted}`
}
