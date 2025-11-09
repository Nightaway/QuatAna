<template>
  <div style="padding: 40px; text-align: center; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); min-height: 100vh; color: white;">
    <h1 style="font-size: 48px; margin-bottom: 20px;">📊 K线图系统</h1>
    <p style="font-size: 18px; color: #b0b0b0; margin-bottom: 40px;">选择要查看的版本</p>
    
    <div style="display: flex; gap: 30px; justify-content: center; flex-wrap: wrap;">
      <!-- 静态数据卡片 -->
      <NuxtLink 
        to="/static" 
        style="
          display: block;
          width: 300px;
          padding: 40px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          text-decoration: none;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        "
      >
        <div style="font-size: 60px; margin-bottom: 20px;">📈</div>
        <h2 style="margin: 0 0 10px 0;">静态数据版本</h2>
        <p style="color: #b0b0b0; font-size: 14px; margin: 0;">使用本地 JSON 数据<br>快速加载 • 离线可用</p>
      </NuxtLink>
      
      <!-- 实时数据卡片 -->
      <NuxtLink 
        to="/realtime" 
        style="
          display: block;
          width: 300px;
          padding: 40px;
          background: rgba(38, 166, 154, 0.1);
          border-radius: 12px;
          text-decoration: none;
          color: white;
          border: 1px solid rgba(38, 166, 154, 0.3);
          transition: all 0.3s ease;
        "
      >
        <div style="font-size: 60px; margin-bottom: 20px;">🔴</div>
        <h2 style="margin: 0 0 10px 0;">实时数据版本</h2>
        <p style="color: #b0b0b0; font-size: 14px; margin: 0;">OKX WebSocket 实时推送<br>生产环境 • 实时更新</p>
      </NuxtLink>
    </div>

    <div style="margin-top: 60px; padding: 20px; background: rgba(255, 255, 255, 0.03); border-radius: 8px;">
      <p style="color: #888; font-size: 14px; margin: 0;">
        基于 KLineChart + Nuxt 3 + OKX API
      </p>
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

