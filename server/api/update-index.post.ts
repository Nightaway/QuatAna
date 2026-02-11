/**
 * 更新指数日K线数据
 * 数据源：东方财富 push2his API
 * 输出：写入 public/ 下对应 JSON 文件
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const INDICES = [
  {
    key: 'hstech',
    name: '恒生科技指数',
    secid: '124.HSTECH',
    startDate: '2020-07-01',
    outputFilename: 'hstech_daily_20200701_20260205.json',
  },
  {
    key: 'hsi',
    name: '恒生指数',
    secid: '100.HSI',
    startDate: '2021-02-01',
    outputFilename: 'hsi_daily.json',
  },
  {
    key: 'csi300',
    name: '沪深300',
    secid: '1.000300',
    startDate: '2005-01-01',
    outputFilename: 'csi300_daily.json',
  },
  {
    key: 'csi500',
    name: '中证500',
    secid: '1.000905',
    startDate: '2007-01-01',
    outputFilename: 'csi500_daily.json',
  },
] as const

type IndexKey = 'hstech' | 'hsi' | 'csi300' | 'csi500'

interface RecordOutput {
  时间: string
  时间戳: string
  开盘价: number
  最高价: number
  最低价: number
  收盘价: number
  成交量: number | null
  成交额: number | null
  确认状态: string
}

async function fetchIndexDaily(secid: string): Promise<RecordOutput[]> {
  const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
  const params = new URLSearchParams({
    secid,
    klt: '101',
    fqt: '1',
    lmt: '10000',
    end: '20500000',
    iscca: '1',
    fields1: 'f1,f2,f3,f4,f5,f6,f7,f8',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64',
    ut: 'f057cbcbce2a86e2866ab8877db1d059',
    forcect: '1',
  })

  const res = await fetch(`${url}?${params}`, { signal: AbortSignal.timeout(30000) })
  const data = await res.json()

  if (!data?.data?.klines?.length) {
    throw new Error(`API 返回异常: ${JSON.stringify(data).slice(0, 300)}`)
  }

  const klines = data.data.klines as string[]
  const today = new Date().toISOString().slice(0, 10)

  const records: RecordOutput[] = []
  for (const line of klines) {
    const parts = line.split(',')
    const date = parts[0]
    const open = parseFloat(parts[1])
    const close = parseFloat(parts[2])
    const high = parseFloat(parts[3])
    const low = parseFloat(parts[4])
    const volume = parts[5] && parts[5] !== '-' ? parseFloat(parts[5]) : 0
    const turnover = parts[6] && parts[6] !== '-' ? parseFloat(parts[6]) : 0

    const ts = new Date(date + 'T00:00:00Z').getTime()
    records.push({
      时间: `${date} 00:00:00`,
      时间戳: String(ts),
      开盘价: Math.round(open * 100) / 100,
      最高价: Math.round(high * 100) / 100,
      最低价: Math.round(low * 100) / 100,
      收盘价: Math.round(close * 100) / 100,
      成交量: volume > 0 ? Math.floor(volume) : null,
      成交额: turnover > 0 ? Math.round(turnover * 100) / 100 : null,
      确认状态: '1',
    })
  }

  return records
}

function filterAndSort(
  records: RecordOutput[],
  startDate: string,
  endDate: string
): RecordOutput[] {
  return records
    .filter((r) => {
      const d = r.时间.slice(0, 10)
      return d >= startDate && d <= endDate
    })
    .sort((a, b) => Number(a.时间戳) - Number(b.时间戳))
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const index = (body?.index ?? 'all') as string

  const targets =
    index === 'all'
      ? INDICES
      : INDICES.filter((cfg) => cfg.key === index)

  if (targets.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid index. Use hstech, hsi, csi300, or all.',
    })
  }

  const updated: string[] = []
  const errors: string[] = []

  for (const cfg of targets) {
    try {
      const rawRecords = await fetchIndexDaily(cfg.secid)
      const endDate = new Date().toISOString().slice(0, 10)
      const records = filterAndSort(rawRecords, cfg.startDate, endDate)

      if (records.length === 0) {
        errors.push(`${cfg.name}: 无有效数据`)
        continue
      }

      const publicDir = join(process.cwd(), 'public')
      mkdirSync(publicDir, { recursive: true })
      const outputPath = join(publicDir, cfg.outputFilename)
      writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf-8')

      updated.push(cfg.key)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${cfg.name}: ${msg}`)
    }
  }

  if (updated.length === 0 && errors.length > 0) {
    throw createError({
      statusCode: 500,
      statusMessage: errors.join('; '),
    })
  }

  return {
    success: true,
    updated,
    message:
      errors.length > 0
        ? `部分失败: ${errors.join('; ')}`
        : `已更新: ${updated.join(', ')}`,
  }
})
