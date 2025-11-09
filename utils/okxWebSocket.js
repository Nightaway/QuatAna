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

