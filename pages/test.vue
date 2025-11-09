<template>
  <div style="padding: 40px; text-align: center; background: #1a1a2e; min-height: 100vh; color: white;">
    <h1>✅ 路由测试页面</h1>
    <p>如果你能看到这个页面，说明 Nuxt 页面路由已经正常工作！</p>
    <div style="margin-top: 30px;">
      <NuxtLink to="/" style="color: #26A69A; margin: 0 10px;">首页</NuxtLink>
      <NuxtLink to="/realtime" style="color: #26A69A; margin: 0 10px;">实时数据</NuxtLink>
      <NuxtLink to="/test" style="color: #26A69A; margin: 0 10px;">测试页</NuxtLink>
    </div>
  </div>
</template>

