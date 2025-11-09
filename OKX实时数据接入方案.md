# OKX 实时数据接入 KLineChart 方案

## 📚 目录
1. [KLineChart 数据加载机制](#数据加载机制)
2. [OKX WebSocket API 介绍](#okx-websocket-api)
3. [完整实现方案](#完整实现方案)
4. [代码示例](#代码示例)
5. [注意事项](#注意事项)

---

## 🔧 数据加载机制

### KLineChart 的 DataLoader 接口

根据源码分析（`src/common/DataLoader.ts`），KLineChart 提供了 `DataLoader` 接口来实现数据加载和实时更新：

```typescript
interface DataLoader {
  // 必须实现：获取历史K线数据
  getBars: (params: DataLoaderGetBarsParams) => void | Promise<void>
  
  // 可选：订阅实时数据
  subscribeBar?: (params: DataLoaderSubscribeBarParams) => void
  
  // 可选：取消订阅
  unsubscribeBar?: (params: DataLoaderUnsubscribeBarParams) => void
}
```

### 各方法详解

#### 1. `getBars` - 获取历史数据
```typescript
interface DataLoaderGetBarsParams {
  type: 'init' | 'forward' | 'backward' | 'update'  // 加载类型
  timestamp: Nullable<number>   // 时间戳
  symbol: SymbolInfo            // 交易对信息
  period: Period                // 周期信息
  callback: (data: KLineData[], more?: boolean) => void  // 回调函数
}
```

**触发时机**：
- `init`: 首次加载
- `forward`: 向前加载更多（拖动到最早数据时）
- `backward`: 向后加载更多（拖动到最新数据时）
- `update`: 数据更新

#### 2. `subscribeBar` - 订阅实时数据
```typescript
interface DataLoaderSubscribeBarParams {
  symbol: SymbolInfo   // 交易对信息
  period: Period       // 周期信息
  callback: (data: KLineData) => void  // 实时数据回调
}
```

**触发时机**：
- 设置交易对后
- 设置周期后
- `getBars` 完成初始加载后

**关键实现**（源码 `Store.ts:706-712`）：
```typescript
if (type === 'init') {
  this._dataLoader?.subscribeBar?.({
    symbol: this._symbol!,
    period: this._period!,
    callback: (data: KLineData) => {
      this._addData(data, 'update')  // 更新单条K线数据
    }
  })
}
```

#### 3. `unsubscribeBar` - 取消订阅
在切换交易对或周期时自动调用，用于清理 WebSocket 连接。

---

## 📡 OKX WebSocket API

### WebSocket 连接地址

- **生产环境**: `wss://ws.okx.com:8443/ws/v5/business`
- **模拟环境**: `wss://wspap.okx.com:8443/ws/v5/business?brokerId=9999`

### K线数据订阅格式

#### 订阅请求
```json
{
  "op": "subscribe",
  "args": [
    {
      "channel": "candle1D",
      "instId": "ETH-USDT"
    }
  ]
}
```

#### 可用的 channel 类型
- `candle1m` - 1分钟
- `candle3m` - 3分钟
- `candle5m` - 5分钟
- `candle15m` - 15分钟
- `candle30m` - 30分钟
- `candle1H` - 1小时
- `candle2H` - 2小时
- `candle4H` - 4小时
- `candle6H` - 6小时
- `candle12H` - 12小时
- `candle1D` - 1天
- `candle1W` - 1周
- `candle1M` - 1月

#### 推送数据格式
```json
{
  "arg": {
    "channel": "candle1D",
    "instId": "ETH-USDT"
  },
  "data": [
    [
      "1597026383085",  // 时间戳（毫秒）
      "3.721",          // 开盘价
      "3.743",          // 最高价
      "3.677",          // 最低价
      "3.708",          // 收盘价
      "8422410",        // 成交量（张）
      "22698348.04828491", // 成交量（币）
      "84229910",       // 成交额
      "1"               // 确认状态：0=未完成，1=已完成
    ]
  ]
}
```

---

## 🎯 完整实现方案

### 方案架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         KLineChart 组件                           │
├─────────────────────────────────────────────────────────────────┤
│  1. 初始化图表                                                    │
│  2. 设置交易对和周期                                              │
│  3. 设置 DataLoader                                              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────────┐
│                      DataLoader 实现                             │
├─────────────────────────────────────────────────────────────────┤
│  getBars:          获取历史数据（OKX REST API）                  │
│  subscribeBar:     订阅实时数据（OKX WebSocket）                 │
│  unsubscribeBar:   取消订阅（关闭 WebSocket）                    │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────────┐
│                       OKX API 服务                               │
├─────────────────────────────────────────────────────────────────┤
│  REST API:   https://www.okx.com/api/v5/market/candles         │
│  WebSocket:  wss://ws.okx.com:8443/ws/v5/business              │
└─────────────────────────────────────────────────────────────────┘
```

### 实现步骤

#### 步骤1: 创建 OKX 数据服务类
创建 `utils/okxDataService.js` 文件，封装 OKX API 调用。

#### 步骤2: 创建 WebSocket 管理类
创建 `utils/okxWebSocket.js` 文件，管理 WebSocket 连接和订阅。

#### 步骤3: 集成到 KLineChart 组件
修改现有的 `KLineChart.vue`，使用 DataLoader 接入实时数据。

---

## 💻 代码示例

### 1. OKX 数据服务类 (`utils/okxDataService.js`)

```javascript
/**
 * OKX 数据服务
 * 提供历史K线数据获取和实时数据订阅
 */

// 周期映射：KLineChart -> OKX
const PERIOD_MAP = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1H': '1H',
  '2H': '2H',
  '4H': '4H',
  '6H': '6H',
  '12H': '12H',
  '1D': '1D',
  '1W': '1W',
  '1M': '1M'
}

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
```

### 2. WebSocket 管理类 (`utils/okxWebSocket.js`)

```javascript
/**
 * OKX WebSocket 管理类
 * 管理 WebSocket 连接、订阅和数据推送
 */

const WS_URL = 'wss://ws.okx.com:8443/ws/v5/business'
const RECONNECT_DELAY = 3000  // 重连延迟（毫秒）
const PING_INTERVAL = 20000   // 心跳间隔（毫秒）

export class OKXWebSocketManager {
  constructor() {
    this.ws = null
    this.connected = false
    this.subscriptions = new Map()  // 存储订阅信息和回调
    this.reconnectTimer = null
    this.pingTimer = null
    this.autoReconnect = true
  }
  
  /**
   * 连接 WebSocket
   */
  connect() {
    if (this.ws && this.connected) {
      console.log('⚠️ WebSocket 已经连接')
      return
    }
    
    console.log('🔌 连接 OKX WebSocket...')
    
    try {
      this.ws = new WebSocket(WS_URL)
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket 连接成功')
        this.connected = true
        this.startPing()
        this.resubscribeAll()
      }
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket 错误:', error)
      }
      
      this.ws.onclose = () => {
        console.log('🔌 WebSocket 连接关闭')
        this.connected = false
        this.stopPing()
        
        if (this.autoReconnect) {
          this.scheduleReconnect()
        }
      }
    } catch (error) {
      console.error('❌ WebSocket 连接失败:', error)
      if (this.autoReconnect) {
        this.scheduleReconnect()
      }
    }
  }
  
  /**
   * 断开连接
   */
  disconnect() {
    this.autoReconnect = false
    this.stopPing()
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.connected = false
    console.log('🔌 WebSocket 已断开')
  }
  
  /**
   * 重连调度
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      return
    }
    
    console.log(`⏱️ ${RECONNECT_DELAY / 1000} 秒后尝试重连...`)
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, RECONNECT_DELAY)
  }
  
  /**
   * 开始心跳
   */
  startPing() {
    this.stopPing()
    
    this.pingTimer = setInterval(() => {
      if (this.connected && this.ws) {
        this.ws.send('ping')
        console.log('💓 发送心跳: ping')
      }
    }, PING_INTERVAL)
  }
  
  /**
   * 停止心跳
   */
  stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
  
  /**
   * 重新订阅所有频道
   */
  resubscribeAll() {
    if (this.subscriptions.size === 0) {
      return
    }
    
    console.log('🔄 重新订阅所有频道...')
    
    this.subscriptions.forEach((callbacks, key) => {
      const [channel, instId] = key.split(':')
      this.sendSubscribe(channel, instId)
    })
  }
  
  /**
   * 处理收到的消息
   */
  handleMessage(data) {
    if (data === 'pong') {
      console.log('💓 收到心跳响应: pong')
      return
    }
    
    try {
      const message = JSON.parse(data)
      
      // 处理订阅响应
      if (message.event === 'subscribe') {
        console.log('✅ 订阅成功:', message.arg)
        return
      }
      
      // 处理取消订阅响应
      if (message.event === 'unsubscribe') {
        console.log('✅ 取消订阅成功:', message.arg)
        return
      }
      
      // 处理K线数据推送
      if (message.arg && message.data) {
        const { channel, instId } = message.arg
        const key = `${channel}:${instId}`
        const callbacks = this.subscriptions.get(key)
        
        if (callbacks && callbacks.size > 0) {
          message.data.forEach(klineData => {
            callbacks.forEach(callback => {
              try {
                callback(klineData)
              } catch (error) {
                console.error('❌ 回调函数执行出错:', error)
              }
            })
          })
        }
      }
    } catch (error) {
      console.error('❌ 解析消息出错:', error)
    }
  }
  
  /**
   * 发送订阅请求
   */
  sendSubscribe(channel, instId) {
    if (!this.connected || !this.ws) {
      console.warn('⚠️ WebSocket 未连接，无法订阅')
      return
    }
    
    const message = {
      op: 'subscribe',
      args: [
        {
          channel,
          instId
        }
      ]
    }
    
    this.ws.send(JSON.stringify(message))
    console.log('📡 发送订阅请求:', message)
  }
  
  /**
   * 发送取消订阅请求
   */
  sendUnsubscribe(channel, instId) {
    if (!this.connected || !this.ws) {
      return
    }
    
    const message = {
      op: 'unsubscribe',
      args: [
        {
          channel,
          instId
        }
      ]
    }
    
    this.ws.send(JSON.stringify(message))
    console.log('📡 发送取消订阅请求:', message)
  }
  
  /**
   * 订阅频道
   */
  subscribe(channel, instId, callback) {
    const key = `${channel}:${instId}`
    
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set())
    }
    
    this.subscriptions.get(key).add(callback)
    
    // 如果已连接，立即发送订阅请求
    if (this.connected) {
      this.sendSubscribe(channel, instId)
    } else {
      // 否则先连接
      this.connect()
    }
  }
  
  /**
   * 取消订阅
   */
  unsubscribe(channel, instId, callback = null) {
    const key = `${channel}:${instId}`
    const callbacks = this.subscriptions.get(key)
    
    if (!callbacks) {
      return
    }
    
    if (callback) {
      // 移除特定回调
      callbacks.delete(callback)
    } else {
      // 移除所有回调
      callbacks.clear()
    }
    
    // 如果该频道没有回调了，发送取消订阅请求
    if (callbacks.size === 0) {
      this.subscriptions.delete(key)
      this.sendUnsubscribe(channel, instId)
    }
  }
  
  /**
   * 取消所有订阅
   */
  unsubscribeAll() {
    this.subscriptions.forEach((callbacks, key) => {
      const [channel, instId] = key.split(':')
      this.sendUnsubscribe(channel, instId)
    })
    
    this.subscriptions.clear()
  }
}

// 创建单例
let wsManagerInstance = null

export function getOKXWebSocketManager() {
  if (!wsManagerInstance) {
    wsManagerInstance = new OKXWebSocketManager()
  }
  return wsManagerInstance
}
```

### 3. 修改 KLineChart 组件 (`components/KLineChart.vue`)

```vue
<script setup>
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import { init, dispose } from 'klinecharts'
import { createOKXDataLoader } from '../utils/okxDataService'
import { getOKXWebSocketManager } from '../utils/okxWebSocket'

const chartRef = ref(null)
let chart = null
let wsManager = null

onMounted(async () => {
  await nextTick()
  
  // 初始化图表
  chart = init('kline-chart')
  
  if (!chart) {
    console.error('图表初始化失败')
    return
  }
  
  console.log('✅ 图表初始化成功')
  
  // 创建 WebSocket 管理器
  wsManager = getOKXWebSocketManager()
  
  // 设置交易对信息
  chart.setSymbol({
    ticker: 'ETH-USDT',
    exchange: 'OKX'
  })
  
  // 设置周期（日线）
  chart.setPeriod({
    span: 1,
    type: 'day'
  })
  
  // 设置 OKX 数据加载器（集成实时数据）
  chart.setDataLoader(createOKXDataLoader(wsManager))
  
  // 配置图表样式
  chart.setStyles({
    candle: {
      type: 'candle_solid',
      bar: {
        upColor: '#26A69A',
        downColor: '#EF5350',
        upBorderColor: '#26A69A',
        downBorderColor: '#EF5350',
        upWickColor: '#26A69A',
        downWickColor: '#EF5350'
      },
      priceMark: {
        high: {
          show: true,
          color: '#76808F'
        },
        low: {
          show: true,
          color: '#76808F'
        },
        last: {
          show: true,
          upColor: '#26A69A',
          downColor: '#EF5350',
          line: {
            show: true,
            style: 'dashed'
          }
        }
      }
    },
    grid: {
      show: true,
      horizontal: {
        show: true,
        color: '#2B2B43'
      },
      vertical: {
        show: false
      }
    },
    crosshair: {
      show: true,
      horizontal: {
        show: true,
        line: {
          show: true,
          style: 'dashed',
          color: '#76808F'
        }
      },
      vertical: {
        show: true,
        line: {
          show: true,
          style: 'dashed',
          color: '#76808F'
        }
      }
    }
  })
  
  // 添加布林带指标
  chart.createIndicator({
    name: 'BOLL',
    calcParams: [20, 2],
    precision: 2,
    styles: {
      lines: [
        {
          style: 'solid',
          smooth: false,
          size: 1,
          color: '#FF6D00'
        },
        {
          style: 'solid',
          smooth: false,
          size: 1,
          color: '#2196F3'
        },
        {
          style: 'solid',
          smooth: false,
          size: 1,
          color: '#00C853'
        }
      ]
    }
  }, true, { id: 'candle_pane' })
  
  console.log('✅ 已添加布林带指标 BOLL(20, 2)')
  
  // 创建成交量指标
  chart.createIndicator('VOL', false)
  
  // 设置可见K线数量和间距
  chart.setBarSpace(10)
  chart.setRightMinVisibleBarCount(3)
  chart.setLeftMinVisibleBarCount(3)
  
  // 滚动到最新数据
  setTimeout(() => {
    chart.scrollToRealTime()
  }, 100)
})

onUnmounted(() => {
  // 断开 WebSocket
  if (wsManager) {
    wsManager.disconnect()
  }
  
  // 销毁图表
  if (chart) {
    dispose('kline-chart')
  }
})
</script>

<template>
  <div class="kline-container">
    <div class="header">
      <h1>ETH/USDT 日线K线图 - 实时数据</h1>
      <p>数据来源：OKX 交易所（实时更新）</p>
    </div>
    <div id="kline-chart" ref="chartRef" class="chart"></div>
  </div>
</template>

<style scoped>
.kline-container {
  width: 100%;
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  box-sizing: border-box;
}

.header {
  text-align: center;
  margin-bottom: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.header h1 {
  color: #fff;
  margin: 0 0 10px 0;
  font-size: 28px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.header p {
  color: #b0b0b0;
  margin: 0;
  font-size: 14px;
  letter-spacing: 0.5px;
}

.chart {
  width: 100%;
  height: 700px;
  background-color: #1e222d;
  border-radius: 12px;
  box-shadow: 
    0 10px 30px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

@media (max-width: 768px) {
  .kline-container {
    padding: 10px;
  }
  
  .chart {
    height: 500px;
    border-radius: 8px;
  }
  
  .header {
    padding: 15px;
    margin-bottom: 15px;
  }
  
  .header h1 {
    font-size: 22px;
  }
  
  .header p {
    font-size: 12px;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.kline-container {
  animation: fadeIn 0.6s ease-out;
}
</style>
```

---

## ⚠️ 注意事项

### 1. CORS 问题
如果直接从浏览器请求 OKX API 遇到 CORS 问题，有以下解决方案：

**方案A**: 使用 Nuxt 服务端 API 路由作为代理
```javascript
// server/api/okx-proxy.js
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const url = `https://www.okx.com/api/v5/market/candles?${new URLSearchParams(query)}`
  
  const data = await $fetch(url)
  return data
})
```

然后在 `okxDataService.js` 中修改请求地址：
```javascript
const url = `/api/okx-proxy?${params.toString()}`
```

**方案B**: 使用 OKX 的 CDN 地址（部分接口支持）

### 2. WebSocket 连接限制
- OKX WebSocket 单个连接最多订阅 **240个频道**
- 建议同一个页面使用单例模式管理 WebSocket 连接
- 切换交易对或周期时，及时取消旧订阅

### 3. 数据更新策略
- 日线及以上周期：可能延迟较大，建议定时轮询
- 分钟级周期：WebSocket 推送及时，适合实时交易

### 4. 错误处理
- 实现 WebSocket 自动重连机制
- API 请求失败时的降级策略
- 数据异常时的提示和处理

### 5. 性能优化
- 限制历史数据加载量（建议单次不超过300条）
- 实时数据去重处理
- 避免频繁的图表重绘

---

## 🎯 后续优化方向

### 1. 多交易对支持
添加交易对选择器，支持动态切换。

### 2. 周期切换
实现周期切换功能（1分钟、5分钟、1小时、日线等）。

### 3. 数据缓存
使用 IndexedDB 或 localStorage 缓存历史数据，减少 API 请求。

### 4. 深度图集成
结合 OKX 深度数据，实现深度图展示。

### 5. 交易功能
集成 OKX 交易 API，实现下单、撤单等功能。

---

## 📚 相关文档

- [KLineChart 官方文档](https://www.klinecharts.com)
- [OKX API 文档](https://www.okx.com/docs-v5/)
- [OKX WebSocket API](https://www.okx.com/docs-v5/zh/#overview-websocket)
- [Nuxt 3 文档](https://nuxt.com)

---

## 🤝 支持

如果在实现过程中遇到问题，可以：

1. 查看控制台日志，所有关键步骤都有详细日志
2. 参考 KLineChart 官方示例
3. 查阅 OKX API 文档
4. 检查网络请求和 WebSocket 连接状态

祝您实现顺利！🎉

