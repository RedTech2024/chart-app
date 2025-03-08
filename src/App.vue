<script setup>
import ChartContainer from './components/ChartContainer.vue'
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>多模式统计图表应用</h1>
      <p>创建、保存和导出各种类型的图表</p>
    </header>
    <main>
      <ChartContainer />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.app-header {
  text-align: center;
  margin-bottom: 30px;
}

.app-header h1 {
  margin-bottom: 8px;
  color: #646cff;
}

.app-header p {
  color: #888;
  font-size: 1.1em;
}
</style>
