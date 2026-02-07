<template>
  <div class="home-page">
    <h1 class="title">K线图系统</h1>
    <p class="subtitle">选择要查看的版本</p>

    <div class="cards-container">
      <!-- 静态数据卡片 -->
      <NuxtLink to="/static" class="card">
        <div class="card-icon">📈</div>
        <h2>静态数据版本</h2>
        <p>使用本地 JSON 数据<br>快速加载 · 离线可用</p>
      </NuxtLink>

      <!-- 实时数据卡片 -->
      <NuxtLink to="/realtime" class="card">
        <div class="card-icon">🔴</div>
        <h2>实时数据版本</h2>
        <p>OKX WebSocket 实时推送<br>生产环境 · 实时更新</p>
      </NuxtLink>
    </div>

    <div class="footer">
      <p>基于 KLineChart + Nuxt 3 + OKX API</p>
    </div>
  </div>
</template>

<script setup>
useHead({
  title: 'K线图系统 - 首页',
  meta: [
    { name: 'description', content: 'ETH/USDT K线图分析系统' }
  ]
})
</script>

<style scoped>
.home-page {
  padding: 40px;
  text-align: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  min-height: 100vh;
}

.title {
  font-size: 48px;
  margin-bottom: 20px;
  color: #333;
}

.subtitle {
  font-size: 18px;
  color: #888;
  margin-bottom: 40px;
}

.cards-container {
  display: flex;
  gap: 30px;
  justify-content: center;
  flex-wrap: wrap;
}

.card {
  display: block;
  width: 300px;
  padding: 40px;
  background: #fff;
  border-radius: 12px;
  text-decoration: none;
  color: #333;
  border: 1px solid #e0e0e0;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.card-icon {
  font-size: 60px;
  margin-bottom: 20px;
}

.card h2 {
  margin: 0 0 10px 0;
  font-size: 20px;
  font-weight: 600;
}

.card p {
  color: #888;
  font-size: 14px;
  margin: 0;
  line-height: 1.6;
}

.footer {
  margin-top: 60px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
}

.footer p {
  color: #888;
  font-size: 14px;
  margin: 0;
}
</style>

