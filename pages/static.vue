<script setup>
import { defineAsyncComponent } from 'vue'

// 使用静态数据的K线图组件
const KLineChart = defineAsyncComponent(() => 
  import('../components/KLineChart.vue')
)

// 设置页面元数据
useHead({
  title: 'K线图 - 恒生科技指数',
  meta: [
    { name: 'description', content: '基于 KLineChart 的恒生科技指数日线K线图' }
  ]
})
</script>

<template>
  <div>
    <ClientOnly>
      <KLineChart />
      <template #fallback>
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>正在加载K线图...</p>
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
  width: 50px;
  height: 50px;
  border: 4px solid #e0e0e0;
  border-top-color: #333;
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
  color: #666;
  font-size: 16px;
  letter-spacing: 1px;
}

</style>

