<template>
  <div class="layout-with-sidebar">
    <nav class="sidebar" :class="{ expanded: isExpanded }">
      <button class="toggle-btn" @click="isExpanded = !isExpanded">
        {{ isExpanded ? '✕' : '☰' }}
      </button>
      <div class="nav-items">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span v-show="isExpanded" class="nav-label">{{ item.label }}</span>
        </NuxtLink>
      </div>
    </nav>
    <div class="sidebar-placeholder" :class="{ expanded: isExpanded }"></div>
    <main class="page-content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const route = useRoute()
const isExpanded = ref(false)

const navItems = [
  { path: '/', icon: '🏠', label: '首页' },
  { path: '/static', icon: '📈', label: '静态数据' },
  { path: '/realtime', icon: '🔴', label: '实时数据' },
  { path: '/backtest', icon: '🧪', label: '策略回测' },
]

function isActive(path) {
  return route.path === path
}
</script>

<style scoped>
.layout-with-sidebar {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 60px;
  background: #1e1e1e;
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: width 0.3s ease;
  overflow: hidden;
}

.sidebar.expanded {
  width: 200px;
}

.toggle-btn {
  width: 100%;
  height: 50px;
  background: none;
  border: none;
  color: #aaa;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.toggle-btn:hover {
  color: #fff;
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  text-decoration: none;
  color: #aaa;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.nav-icon {
  font-size: 20px;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.nav-label {
  font-size: 14px;
  font-weight: 500;
}

.sidebar-placeholder {
  width: 60px;
  flex-shrink: 0;
  transition: width 0.3s ease;
}

.sidebar-placeholder.expanded {
  width: 200px;
}

.page-content {
  flex: 1;
  min-width: 0;
}

@media (max-width: 768px) {
  .sidebar.expanded {
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
  }

  .sidebar-placeholder {
    width: 60px !important;
  }
}
</style>
