<template>
  <div class="test-page">
    <h1>✅ 路由测试页面</h1>
    <p>如果你能看到这个页面，说明 Nuxt 页面路由已经正常工作！</p>
    <div class="nav-links">
      <NuxtLink to="/">首页</NuxtLink>
      <NuxtLink to="/realtime">实时数据</NuxtLink>
      <NuxtLink to="/test">测试页</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.test-page {
  padding: 40px;
  text-align: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  min-height: 100vh;
  color: #333;
}

.test-page h1 {
  margin-bottom: 20px;
}

.test-page p {
  color: #666;
  margin-bottom: 30px;
}

.nav-links {
  display: flex;
  justify-content: center;
  gap: 20px;
}

.nav-links a {
  color: #333;
  text-decoration: none;
  padding: 10px 20px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  transition: all 0.3s ease;
}

.nav-links a:hover {
  background: #f5f5f5;
}
</style>

