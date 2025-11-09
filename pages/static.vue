<script setup>
import { defineAsyncComponent } from 'vue'

// 使用静态数据的K线图组件
const KLineChart = defineAsyncComponent(() => 
  import('../components/KLineChart.vue')
)

// 设置页面元数据
useHead({
  title: 'K线图 - 静态数据演示',
  meta: [
    { name: 'description', content: '基于 KLineChart 的 ETH/USDT 日线K线图，使用静态数据' }
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
    
    <!-- 导航按钮 -->
    <div class="nav-buttons">
      <NuxtLink to="/" class="btn btn-home">
        <span class="icon">🏠</span>
        返回首页
      </NuxtLink>
      <NuxtLink to="/realtime" class="btn btn-realtime">
        <span class="icon">🔴</span>
        实时数据版本
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
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: #26A69A;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  box-shadow: 0 0 20px rgba(38, 166, 154, 0.3);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-container p {
  margin-top: 20px;
  color: #b0b0b0;
  font-size: 16px;
  letter-spacing: 1px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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
}

.btn-home {
  background: linear-gradient(135deg, #9C27B0 0%, #673AB7 100%);
  box-shadow: 0 4px 15px rgba(156, 39, 176, 0.3);
}

.btn-home:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(156, 39, 176, 0.4);
}

.btn-realtime {
  background: linear-gradient(135deg, #EF5350 0%, #E91E63 100%);
  box-shadow: 0 4px 15px rgba(239, 83, 80, 0.3);
  animation: pulse-glow 2s ease-in-out infinite;
}

.btn-realtime:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(239, 83, 80, 0.4);
}

.btn .icon {
  font-size: 16px;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 4px 15px rgba(239, 83, 80, 0.3);
  }
  50% {
    box-shadow: 0 4px 20px rgba(239, 83, 80, 0.5);
  }
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

