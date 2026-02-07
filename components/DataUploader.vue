<template>
  <div class="data-uploader">
    <div
      class="upload-area"
      :class="{ 'drag-over': isDragOver }"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".json,.csv"
        style="display: none"
        @change="handleFileSelect"
      />
      <div class="upload-icon">📁</div>
      <div class="upload-text">
        <p class="main-text">拖拽文件到此处或点击上传</p>
        <p class="sub-text">支持 JSON、CSV 格式</p>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="dataStats" class="data-preview">
      <h4>数据预览</h4>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="label">数据条数</span>
          <span class="value">{{ dataStats.count }}</span>
        </div>
        <div class="stat-item">
          <span class="label">开始日期</span>
          <span class="value">{{ dataStats.startDate }}</span>
        </div>
        <div class="stat-item">
          <span class="label">结束日期</span>
          <span class="value">{{ dataStats.endDate }}</span>
        </div>
        <div class="stat-item">
          <span class="label">价格范围</span>
          <span class="value">{{ dataStats.minPrice }} - {{ dataStats.maxPrice }}</span>
        </div>
      </div>

      <div class="preview-table">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>开盘</th>
              <th>最高</th>
              <th>最低</th>
              <th>收盘</th>
              <th>成交量</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in previewData" :key="index">
              <td>{{ row.dateStr }}</td>
              <td>{{ row.open.toFixed(2) }}</td>
              <td>{{ row.high.toFixed(2) }}</td>
              <td>{{ row.low.toFixed(2) }}</td>
              <td>{{ row.close.toFixed(2) }}</td>
              <td>{{ formatVolume(row.volume) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button class="clear-btn" @click="clearData">清除数据</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { parseUploadedFile, getDataPreview, getDataStats } from '~/utils/dataLoader'

const emit = defineEmits(['data-loaded', 'data-cleared'])

const fileInput = ref(null)
const isDragOver = ref(false)
const error = ref('')
const dataStats = ref(null)
const previewData = ref([])

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileSelect(event) {
  const file = event.target.files?.[0]
  if (file) {
    await processFile(file)
  }
}

async function handleDrop(event) {
  isDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    await processFile(file)
  }
}

async function processFile(file) {
  error.value = ''
  try {
    const data = await parseUploadedFile(file)
    dataStats.value = getDataStats(data)
    previewData.value = getDataPreview(data, 5)
    emit('data-loaded', data)
  } catch (e) {
    error.value = e.message
    dataStats.value = null
    previewData.value = []
  }
}

function clearData() {
  dataStats.value = null
  previewData.value = []
  error.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  emit('data-cleared')
}

function formatVolume(vol) {
  if (vol >= 1000000) {
    return (vol / 1000000).toFixed(2) + 'M'
  } else if (vol >= 1000) {
    return (vol / 1000).toFixed(2) + 'K'
  }
  return vol.toFixed(2)
}
</script>

<style scoped>
.data-uploader {
  width: 100%;
}

.upload-area {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #f9f9f9;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: #666;
  background: #f0f0f0;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.main-text {
  color: #333;
  font-size: 16px;
  margin: 0 0 5px 0;
}

.sub-text {
  color: #888;
  font-size: 14px;
  margin: 0;
}

.error-message {
  margin-top: 10px;
  padding: 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 14px;
}

.data-preview {
  margin-top: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 12px;
}

.data-preview h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 15px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.stat-item .label {
  color: #888;
  font-size: 13px;
}

.stat-item .value {
  color: #333;
  font-size: 13px;
  font-weight: 500;
}

.preview-table {
  overflow-x: auto;
  margin-bottom: 15px;
}

.preview-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.preview-table th,
.preview-table td {
  padding: 8px 10px;
  text-align: right;
  border-bottom: 1px solid #e0e0e0;
}

.preview-table th {
  color: #888;
  font-weight: 500;
}

.preview-table td {
  color: #333;
}

.preview-table th:first-child,
.preview-table td:first-child {
  text-align: left;
}

.clear-btn {
  width: 100%;
  padding: 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.clear-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}
</style>
