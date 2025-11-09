# ETH/USDT K线图应用

## 📋 项目说明

这是一个基于 Vue3 和 Nuxt3 开发的K线图应用，使用 KLineChart 库显示 ETH/USDT 交易对的日线数据。

## ✨ 主要功能

- 📊 显示ETH/USDT最近30天的日线K线图
- 📈 自动加载成交量指标（VOL）
- 🎨 响应式设计，支持移动端
- 🖱️ 支持缩放、拖拽等交互操作

## 🚀 运行项目

### 1. 启动开发服务器

```bash
npm run dev
```

### 2. 在浏览器中访问

打开浏览器访问：http://localhost:3000

## 📁 项目结构

```
okx_trading/
├── components/
│   └── KLineChart.client.vue   # K线图组件（仅客户端渲染）
├── app/
│   └── app.vue                 # 主应用入口
├── eth_usdt_swap_daily_30d.json # ETH/USDT交易数据
├── package.json
└── nuxt.config.ts
```

## 🔧 技术栈

- **Vue 3** - 前端框架
- **Nuxt 3** - Vue应用框架
- **KLineChart** - 专业的K线图表库

## 📊 数据格式

原始数据（eth_usdt_swap_daily_30d.json）包含以下字段：
- 时间
- 时间戳
- 开盘价
- 最高价
- 最低价
- 收盘价
- 成交量(张)
- 成交量(币)
- 成交额(USDT)

数据会自动转换为 KLineChart 所需的格式：
```javascript
{
  timestamp: 1759939200000,  // 时间戳
  open: 4445.04,            // 开盘价
  high: 4555.9,             // 最高价
  low: 4288.0,              // 最低价
  close: 4312.36,           // 收盘价
  volume: 3600506.03        // 成交量
}
```

## 🎮 图表操作

- **缩放**: 使用鼠标滚轮或触摸板进行缩放
- **拖拽**: 鼠标左键拖拽或手指滑动查看不同时间段
- **十字线**: 悬停查看具体K线的详细数据

## 📝 组件说明

### KLineChart.client.vue

这是主要的K线图组件，包含以下功能：

1. **数据加载**: 从 JSON 文件加载并转换数据格式
2. **图表初始化**: 使用 klinecharts 的 init 方法创建图表
3. **样式配置**: 包含响应式布局和美观的样式设计
4. **生命周期管理**: 在组件卸载时正确销毁图表实例
5. **仅客户端渲染**: 使用 `.client.vue` 后缀，避免 SSR 错误

> ⚠️ **重要**: 组件文件名必须是 `.client.vue` 后缀，因为 KLineChart 使用 canvas，需要浏览器环境，不能在服务端渲染（SSR）。

## 🔄 数据更新

如果需要更新数据，只需替换 `eth_usdt_swap_daily_30d.json` 文件，保持相同的数据格式即可。

## 📱 响应式设计

- 桌面端：图表高度 700px
- 移动端：图表高度 500px，自适应屏幕宽度

## 🛠️ 自定义配置

你可以在 `KLineChart.client.vue` 组件中自定义：

- 图表样式
- 技术指标
- 交易对信息
- 时间周期

参考 [KLineChart 官方文档](https://www.klinecharts.com) 了解更多配置选项。

## ⚠️ SSR 注意事项

由于 KLineChart 使用 canvas API，需要在浏览器环境中运行，因此采用了以下方案：

1. **组件命名**: 使用 `.client.vue` 后缀，Nuxt 会自动识别为仅客户端组件
2. **ClientOnly 包裹**: 在 `app.vue` 中使用 `<ClientOnly>` 组件包裹
3. **加载提示**: 提供友好的加载动画，提升用户体验

这样可以避免 "Failed to resolve component" 的 SSR 警告。

## 📦 依赖包

主要依赖：
- `klinecharts`: ^10.0.0-alpha9 - K线图表库
- `vue`: ^3.5.22 - Vue框架
- `nuxt`: ^4.2.1 - Nuxt框架

### ⚠️ 版本要求

- **klinecharts 最低版本要求**：`10.0.0-alpha7`
- **原因**：`setSymbol` 和 `setPeriod` API 是在 alpha7 版本新增的

如果遇到 `chart.setSymbol is not a function` 错误，请升级：
```bash
npm install klinecharts@10.0.0-alpha9 --save
```

## 🎯 下一步优化建议

1. 添加更多技术指标（MA、MACD、KDJ等）
2. 实现时间周期切换功能
3. 添加绘图工具
4. 实现实时数据更新
5. 添加多交易对切换功能

