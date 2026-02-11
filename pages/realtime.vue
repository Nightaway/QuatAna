<script setup>
import { defineAsyncComponent } from 'vue'

// 使用实时数据的K线图组件
const KLineChartRealtime = defineAsyncComponent(() => 
  import('../components/KLineChartRealtime.vue')
)

// 设置页面元数据
useHead({
  title: 'K线图 - OKX 实时数据',
  meta: [
    { name: 'description', content: '基于 KLineChart 的 ETH/USDT 实时K线图，通过 WebSocket 连接 OKX 交易所' }
  ]
})
</script>

<template>
  <div>
    <ClientOnly>
      <KLineChartRealtime />
      <template #fallback>
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>正在连接 OKX 交易所...</p>
          <p class="loading-tips">首次加载可能需要几秒钟</p>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 5px solid #e0e0e0;
  border-top-color: #333;
  border-right-color: #666;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-container p {
  margin-top: 20px;
  color: #333;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
}

.loading-tips {
  margin-top: 10px !important;
  font-size: 14px !important;
  font-weight: 400 !important;
  color: #888 !important;
}

</style>

