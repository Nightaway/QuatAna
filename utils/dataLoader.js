/**
 * 数据加载与解析模块
 * Data Loader Module
 */

/**
 * 可用的数据源配置
 */
export const DATA_SOURCES = {
  daily: {
    key: 'daily',
    label: '日线 30天',
    file: '/eth_usdt_swap_daily_30d.json',
    period: '1D',
    description: 'ETH/USDT 日线数据（30天）'
  },
  '15m': {
    key: '15m',
    label: '15分钟 7天',
    file: '/eth_usdt_swap_15m_7d_20260203.json',
    period: '15m',
    description: 'ETH/USDT 15分钟数据（7天）'
  }
}

/**
 * 获取数据源列表
 * @returns {Array} 数据源列表
 */
export function getDataSourceList() {
  return Object.values(DATA_SOURCES)
}

/**
 * 加载默认 JSON 数据文件
 * @param {string} sourceKey - 数据源键名，默认 'daily'
 * @returns {Promise<Array>} K线数据数组
 */
export async function loadDefaultData(sourceKey = 'daily') {
  try {
    const source = DATA_SOURCES[sourceKey] || DATA_SOURCES.daily
    const response = await fetch(source.file)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    return transformData(data)
  } catch (error) {
    console.error('加载默认数据失败:', error)
    throw error
  }
}

/**
 * 解析上传的文件
 * @param {File} file - 上传的文件对象
 * @returns {Promise<Array>} K线数据数组
 */
export async function parseUploadedFile(file) {
  const content = await readFileContent(file)
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.json')) {
    return parseJSON(content)
  } else if (fileName.endsWith('.csv')) {
    return parseCSV(content)
  } else {
    throw new Error('不支持的文件格式，请上传 JSON 或 CSV 文件')
  }
}

/**
 * 读取文件内容
 * @param {File} file - 文件对象
 * @returns {Promise<string>} 文件内容
 */
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = (e) => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

/**
 * 解析 JSON 数据
 * @param {string} content - JSON 字符串
 * @returns {Array} K线数据数组
 */
function parseJSON(content) {
  try {
    const data = JSON.parse(content)
    return transformData(data)
  } catch (error) {
    throw new Error('JSON 解析失败: ' + error.message)
  }
}

/**
 * 解析 CSV 数据
 * @param {string} content - CSV 字符串
 * @returns {Array} K线数据数组
 */
function parseCSV(content) {
  const lines = content.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('CSV 文件数据不足')
  }

  // 解析表头
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const fieldMap = mapCSVFields(headers)

  // 解析数据行
  const data = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length < headers.length) continue

    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index]
    })

    const kline = {
      timestamp: parseTimestamp(row[fieldMap.timestamp]),
      open: parseFloat(row[fieldMap.open]),
      high: parseFloat(row[fieldMap.high]),
      low: parseFloat(row[fieldMap.low]),
      close: parseFloat(row[fieldMap.close]),
      volume: parseFloat(row[fieldMap.volume] || 0)
    }

    if (validateKline(kline)) {
      data.push(kline)
    }
  }

  if (data.length === 0) {
    throw new Error('未能解析出有效的K线数据')
  }

  // 按时间排序
  data.sort((a, b) => a.timestamp - b.timestamp)
  return data
}

/**
 * 解析 CSV 行（处理引号内的逗号）
 * @param {string} line - CSV 行
 * @returns {Array} 字段值数组
 */
function parseCSVLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

/**
 * 映射 CSV 字段名
 * @param {Array} headers - 表头数组
 * @returns {Object} 字段映射
 */
function mapCSVFields(headers) {
  const fieldMappings = {
    timestamp: ['timestamp', 'time', 'date', 'datetime', '时间', '日期', 'ts'],
    open: ['open', 'o', '开盘价', '开盘', 'openprice'],
    high: ['high', 'h', '最高价', '最高', 'highprice'],
    low: ['low', 'l', '最低价', '最低', 'lowprice'],
    close: ['close', 'c', '收盘价', '收盘', 'closeprice'],
    volume: ['volume', 'vol', 'v', '成交量', '交易量']
  }

  const result = {}
  for (const [field, aliases] of Object.entries(fieldMappings)) {
    const found = headers.find(h => aliases.includes(h.toLowerCase()))
    if (found) {
      result[field] = found
    } else if (field !== 'volume') {
      throw new Error(`未找到必需字段: ${field}`)
    }
  }

  return result
}

/**
 * 解析时间戳
 * @param {string|number} value - 时间值
 * @returns {number} 毫秒时间戳
 */
function parseTimestamp(value) {
  if (!value) return 0

  // 如果是数字
  const num = Number(value)
  if (!isNaN(num)) {
    // 判断是秒还是毫秒
    if (num < 10000000000) {
      return num * 1000 // 秒转毫秒
    }
    return num
  }

  // 尝试解析日期字符串
  const date = new Date(value)
  if (!isNaN(date.getTime())) {
    return date.getTime()
  }

  return 0
}

/**
 * 转换数据格式
 * @param {Array} data - 原始数据
 * @returns {Array} 标准化的K线数据
 */
function transformData(data) {
  if (!Array.isArray(data)) {
    throw new Error('数据格式错误：期望数组')
  }

  const result = data.map(item => {
    // 处理数组格式 [timestamp, open, high, low, close, volume, ...]
    if (Array.isArray(item)) {
      return {
        timestamp: parseTimestamp(item[0]),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5] || 0)
      }
    }

    // 处理对象格式 - 支持中文和英文字段名
    const timestamp = item.timestamp || item.time || item.ts || item['时间戳'] || item['时间']
    const open = item.open || item.o || item['开盘价'] || item['开盘']
    const high = item.high || item.h || item['最高价'] || item['最高']
    const low = item.low || item.l || item['最低价'] || item['最低']
    const close = item.close || item.c || item['收盘价'] || item['收盘']
    const volume = item.volume || item.vol || item.v || item['成交量'] || item['成交量(币)'] || item['成交量(张)'] || 0

    return {
      timestamp: parseTimestamp(timestamp),
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: parseFloat(volume)
    }
  }).filter(validateKline)

  if (result.length === 0) {
    throw new Error('未能解析出有效的K线数据')
  }

  // 按时间排序
  result.sort((a, b) => a.timestamp - b.timestamp)
  return result
}

/**
 * 验证K线数据有效性
 * @param {Object} kline - K线数据
 * @returns {boolean} 是否有效
 */
function validateKline(kline) {
  return (
    kline.timestamp > 0 &&
    !isNaN(kline.open) &&
    !isNaN(kline.high) &&
    !isNaN(kline.low) &&
    !isNaN(kline.close) &&
    kline.high >= kline.low &&
    kline.high >= kline.open &&
    kline.high >= kline.close &&
    kline.low <= kline.open &&
    kline.low <= kline.close
  )
}

/**
 * 获取数据预览
 * @param {Array} data - K线数据
 * @param {number} count - 预览行数
 * @returns {Array} 预览数据
 */
export function getDataPreview(data, count = 5) {
  return data.slice(0, count).map(item => ({
    ...item,
    dateStr: new Date(item.timestamp).toLocaleString()
  }))
}

/**
 * 获取数据统计信息
 * @param {Array} data - K线数据
 * @returns {Object} 统计信息
 */
export function getDataStats(data) {
  if (!data || data.length === 0) {
    return null
  }

  const startDate = new Date(data[0].timestamp)
  const endDate = new Date(data[data.length - 1].timestamp)
  const prices = data.map(d => d.close)

  return {
    count: data.length,
    startDate: startDate.toLocaleDateString(),
    endDate: endDate.toLocaleDateString(),
    minPrice: Math.min(...prices).toFixed(2),
    maxPrice: Math.max(...prices).toFixed(2),
    avgPrice: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
  }
}
