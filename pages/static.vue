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
  background: #333;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.btn-home:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.btn-realtime {
  background: #555;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.btn-realtime:hover {
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

