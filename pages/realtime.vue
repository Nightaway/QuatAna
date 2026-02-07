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
    
    <!-- 导航按钮 -->
    <div class="nav-buttons">
      <NuxtLink to="/" class="btn btn-home">
        <span class="icon">🏠</span>
        返回首页
      </NuxtLink>
      <NuxtLink to="/static" class="btn btn-static">
        <span class="icon">📊</span>
        静态数据版本
      </NuxtLink>
    </div>
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

.nav-buttons {
  position: fixed;
  bottom: 30px;
  right: 30px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 1000;
}

.btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  color: white;
  text-decoration: none;
  border-radius: 50px;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.btn-home {
  background: #333;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.btn-home:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.btn-static {
  background: #555;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.btn-static:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.btn .icon {
  font-size: 16px;
}

@media (max-width: 768px) {
  .nav-buttons {
    bottom: 20px;
    right: 20px;
  }

  .btn {
    padding: 10px 16px;
    font-size: 12px;
  }
}
</style>

