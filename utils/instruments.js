/**
 * OKX 交易品种和周期配置
 */

// 现货交易对
export const SPOT_INSTRUMENTS = [
  { instId: 'BTC-USDT', name: 'BTC/USDT' },
  { instId: 'ETH-USDT', name: 'ETH/USDT' },
  { instId: 'SOL-USDT', name: 'SOL/USDT' },
  { instId: 'XRP-USDT', name: 'XRP/USDT' },
  { instId: 'DOGE-USDT', name: 'DOGE/USDT' },
  { instId: 'ADA-USDT', name: 'ADA/USDT' },
  { instId: 'AVAX-USDT', name: 'AVAX/USDT' },
  { instId: 'LINK-USDT', name: 'LINK/USDT' },
  { instId: 'DOT-USDT', name: 'DOT/USDT' },
  { instId: 'MATIC-USDT', name: 'MATIC/USDT' },
  { instId: 'UNI-USDT', name: 'UNI/USDT' },
  { instId: 'ATOM-USDT', name: 'ATOM/USDT' },
]

// 永续合约交易对
export const SWAP_INSTRUMENTS = [
  { instId: 'BTC-USDT-SWAP', name: 'BTC/USDT' },
  { instId: 'ETH-USDT-SWAP', name: 'ETH/USDT' },
  { instId: 'SOL-USDT-SWAP', name: 'SOL/USDT' },
  { instId: 'XRP-USDT-SWAP', name: 'XRP/USDT' },
  { instId: 'DOGE-USDT-SWAP', name: 'DOGE/USDT' },
  { instId: 'ADA-USDT-SWAP', name: 'ADA/USDT' },
  { instId: 'AVAX-USDT-SWAP', name: 'AVAX/USDT' },
  { instId: 'LINK-USDT-SWAP', name: 'LINK/USDT' },
]

// K线周期
export const PERIODS = [
  { label: '1m',  span: 1,  type: 'minute' },
  { label: '5m',  span: 5,  type: 'minute' },
  { label: '15m', span: 15, type: 'minute' },
  { label: '1H',  span: 1,  type: 'hour' },
  { label: '4H',  span: 4,  type: 'hour' },
  { label: '1D',  span: 1,  type: 'day' },
  { label: '1W',  span: 1,  type: 'week' },
]

// 类型标签
export const INST_TYPES = [
  { key: 'SPOT', label: '现货' },
  { key: 'SWAP', label: '永续合约' },
]

export function getInstruments(instType) {
  return instType === 'SWAP' ? SWAP_INSTRUMENTS : SPOT_INSTRUMENTS
}
