<script setup>
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import { init, dispose } from 'klinecharts'

// 从JSON文件导入数据
import rawData from '../eth_usdt_swap_daily_30d.json'

const chartRef = ref(null)
let chart = null

// 转换数据格式
const transformData = (data) => {
  return data.map(item => ({
    timestamp: parseInt(item.时间戳),
    open: item.开盘价,
    high: item.最高价,
    low: item.最低价,
    close: item.收盘价,
    volume: item['成交量(币)']
  }))
}

onMounted(async () => {
  // 等待 DOM 完全渲染
  await nextTick()
  
  // 初始化图表
  chart = init('kline-chart')
  
  // 检查 chart 是否成功初始化
  if (!chart) {
    console.error('图表初始化失败：无法找到 DOM 元素')
    return
  }
  
  // 1. 设置交易对信息和周期
  chart.setSymbol({ 
    ticker: 'ETH-USDT',
    exchange: 'OKX'
  })
  
  chart.setPeriod({ 
    span: 1, 
    type: 'day'
  })
  
  // 2. 设置数据加载器
  chart.setDataLoader({
    getBars: ({ callback }) => {
      const transformedData = transformData(rawData)
      console.log(`✅ 加载了 ${transformedData.length} 根K线`)
      console.log('📊 第一条数据:', transformedData[0])
      console.log('📊 最后一条数据:', transformedData[transformedData.length - 1])
      callback(transformedData)
    }
  })
  
  // 3. 配置专业的蜡烛图样式
  chart.setStyles({
    candle: {
      type: 'candle_solid', // 实心蜡烛图
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
  
  // 4. 在主图上添加布林带指标
  chart.createIndicator({
    name: 'BOLL',
    calcParams: [20, 2],  // 周期：20，标准差倍数：2
    precision: 2,
    styles: {
      lines: [
        {
          style: 'solid',
          smooth: false,
          size: 1,
          color: '#FF6D00'  // 上轨：橙色
        },
        {
          style: 'solid',
          smooth: false,
          size: 1,
          color: '#2196F3'  // 中轨：蓝色
        },
        {
          style: 'solid',
          smooth: false,
          size: 1,
          color: '#00C853'  // 下轨：绿色
        }
      ]
    }
  }, true, { id: 'candle_pane' })
  
  console.log('✅ 已添加布林带指标 BOLL(20, 2)')
  
  // 5. 创建成交量指标（在独立窗口）
  chart.createIndicator('VOL', false)
  
  // 6. 创建MACD指标（在独立窗口）
  chart.createIndicator({
    name: 'MACD',
    calcParams: [12, 26, 9],  // 快线：12，慢线：26，信号线：9
    precision: 2,
    styles: {
      bars: [
        {
          upColor: 'rgba(38, 166, 154, 0.7)',
          downColor: 'rgba(239, 83, 80, 0.7)',
          noChangeColor: '#888888'
        }
      ],
      lines: [
        {
          style: 'solid',
          smooth: false,
          size: 1,
          color: '#FF6D00'  // DIF线：橙色
        },
        {
          style: 'solid',
          smooth: false,
          size: 1,
          color: '#2196F3'  // DEA线：蓝色
        }
      ]
    }
  }, false)
  
  console.log('✅ 已添加MACD指标 (12, 26, 9)')
  
  // 7. 创建RSI指标（在独立窗口）
  chart.createIndicator({
    name: 'RSI',
    calcParams: [14],  // 周期：14
    precision: 2,
    styles: {
      lines: [
        {
          style: 'solid',
          smooth: false,
          size: 2,
          color: '#FF6D00'  // RSI线：橙色
        }
      ]
    }
  }, false)
  
  console.log('✅ 已添加RSI指标 (14)')
  
  // 8. 设置可见K线数量和间距
  chart.setBarSpace(10)
  chart.setRightMinVisibleBarCount(3)
  chart.setLeftMinVisibleBarCount(3)
  
  // 9. 滚动到最新数据
  setTimeout(() => {
    chart.scrollToRealTime()
  }, 100)
})

onUnmounted(() => {
  // 销毁图表实例
  if (chart) {
    dispose('kline-chart')
  }
})
</script>

<template>
  <div class="kline-container">
    <div class="header">
      <h1>ETH/USDT 日线K线图</h1>
      <p>数据来源：OKX 交易所（最近30天）</p>
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

/* 添加加载动画效果 */
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

