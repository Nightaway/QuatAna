/**
 * OKX 数据服务
 * 提供历史K线数据获取和实时数据订阅
 */

// 将 KLineChart 的 Period 转换为 OKX 的 bar 参数
function convertPeriodToBar(period) {
  const { span, type } = period
  
  if (type === 'minute') {
    return `${span}m`
  } else if (type === 'hour') {
    return `${span}H`
  } else if (type === 'day') {
    return `${span}D`
  } else if (type === 'week') {
    return `${span}W`
  } else if (type === 'month') {
    return `${span}M`
  }
  
  return '1D' // 默认日线
}

// 将 OKX 的 K线数据转换为 KLineChart 格式
function transformOKXData(okxData) {
  return okxData.map(item => ({
    timestamp: parseInt(item[0]),       // 时间戳
    open: parseFloat(item[1]),          // 开盘价
    high: parseFloat(item[2]),          // 最高价
    low: parseFloat(item[3]),           // 最低价
    close: parseFloat(item[4]),         // 收盘价
    volume: parseFloat(item[6]),        // 成交量（币）
    turnover: parseFloat(item[7])       // 成交额
  }))
}

/**
 * 获取历史K线数据
 * @param {string} instId - 产品ID，如 'ETH-USDT'
 * @param {string} bar - K线周期，如 '1D'
 * @param {number} limit - 数据条数，最大300
 * @param {number} after - 请求此时间戳之前的数据
 * @param {number} before - 请求此时间戳之后的数据
 */
export async function getHistoryKLineData(instId, bar, limit = 100, after = null, before = null) {
  try {
    const params = new URLSearchParams({
      instId,
      bar,
      limit: limit.toString()
    })
    
    if (after) {
      params.append('after', after.toString())
    }
    if (before) {
      params.append('before', before.toString())
    }
    
    // 注意：如果遇到 CORS 问题，需要使用 Nuxt API 路由代理
    // 参考方案文档中的 "CORS 问题" 章节
    const url = `https://www.okx.com/api/v5/market/candles?${params.toString()}`
    
    console.log('📡 请求OKX历史数据:', url)
    
    const response = await fetch(url)
    const result = await response.json()
    
    if (result.code === '0' && result.data) {
      const klineData = transformOKXData(result.data)
      console.log(`✅ 获取到 ${klineData.length} 条K线数据`)
      return klineData.reverse() // OKX 返回的数据是倒序的，需要反转
    } else {
      console.error('❌ 获取OKX数据失败:', result.msg)
      return []
    }
  } catch (error) {
    console.error('❌ 请求OKX API出错:', error)
    return []
  }
}

/**
 * 创建 KLineChart 的 DataLoader
 */
export function createOKXDataLoader(wsManager) {
  return {
    // 获取历史K线数据
    getBars: async ({ type, timestamp, symbol, period, callback }) => {
      console.log('📊 DataLoader.getBars 被调用:', { type, timestamp, symbol, period })
      
      const instId = symbol.ticker  // 例如: 'ETH-USDT'
      const bar = convertPeriodToBar(period)
      
      let data = []
      
      switch (type) {
        case 'init':
          // 初始加载：获取最新的300条数据
          data = await getHistoryKLineData(instId, bar, 300)
          callback(data, false) // false 表示没有更多数据了
          break
          
        case 'forward':
          // 向前加载：获取 timestamp 之前的数据
          if (timestamp) {
            data = await getHistoryKLineData(instId, bar, 100, null, timestamp)
            callback(data, data.length === 100) // 如果返回100条，可能还有更多
          } else {
            callback([], false)
          }
          break
          
        case 'backward':
          // 向后加载：获取 timestamp 之后的数据
          if (timestamp) {
            data = await getHistoryKLineData(instId, bar, 100, timestamp, null)
            callback(data, data.length === 100)
          } else {
            callback([], false)
          }
          break
          
        default:
          callback([], false)
      }
    },
    
    // 订阅实时K线数据
    subscribeBar: ({ symbol, period, callback }) => {
      console.log('🔔 订阅实时数据:', symbol, period)
      
      const instId = symbol.ticker
      const bar = convertPeriodToBar(period)
      const channel = `candle${bar}`
      
      // 使用 WebSocket 管理器订阅
      wsManager.subscribe(channel, instId, (data) => {
        // 将 OKX WebSocket 数据转换为 KLineChart 格式
        const klineData = {
          timestamp: parseInt(data[0]),
          open: parseFloat(data[1]),
          high: parseFloat(data[2]),
          low: parseFloat(data[3]),
          close: parseFloat(data[4]),
          volume: parseFloat(data[6]),
          turnover: parseFloat(data[7])
        }
        
        console.log('📈 收到实时K线数据:', klineData)
        callback(klineData)
      })
    },
    
    // 取消订阅
    unsubscribeBar: ({ symbol, period }) => {
      console.log('🔕 取消订阅:', symbol, period)
      
      const instId = symbol.ticker
      const bar = convertPeriodToBar(period)
      const channel = `candle${bar}`
      
      wsManager.unsubscribe(channel, instId)
    }
  }
}

