<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import * as echarts from 'echarts';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Delete, Edit, Download, Upload, Plus, Refresh, Document, Picture } from '@element-plus/icons-vue';
import JSZip from 'jszip';

// 图表类型选项
const chartTypes = [
  { value: 'bar', label: '柱状图' },
  { value: 'line', label: '折线图' },
  { value: 'pie', label: '饼图' },
  { value: 'scatter', label: '散点图' }
];

// 默认颜色列表
const defaultColors = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'
];

// 图表数据和配置
const chartData = reactive({
  title: '',
  type: 'bar',
  data: []
});

// 新数据输入
const newDataItem = reactive({
  name: '',
  value: '',
  color: '#5470c6' // 默认颜色
});

// 批量数据输入相关
const batchDataInput = ref('');
const batchDataDelimiter = ref('auto');

// 批量生成相同数据相关
const batchGenerateData = reactive({
  count: 5,
  namePrefix: '数据',
  value: 100,
  color: '#5470c6'
});

// 编辑状态
const editingIndex = ref(-1); // -1 表示没有在编辑状态

// 文件导入相关
const fileInput = ref(null);
const importType = ref('json');

// 保存的图表列表
const savedCharts = useLocalStorage('saved-charts', []);

// 当前选中的图表索引
const currentChartIndex = ref(-1);

// 折叠面板激活项
const activeCollapse = ref(['chart-settings', 'data-management']);

// 图表实例
let chartInstance = null;

// 初始化图表
const initChart = () => {
  const chartDom = document.getElementById('chart-container');
  if (!chartDom) return;
  
  chartInstance = echarts.init(chartDom);
  updateChart();
};

// 更新图表
const updateChart = () => {
  if (!chartInstance) return;
  
  const option = {
    title: {
      text: chartData.title || '未命名图表'
    },
    tooltip: {
      trigger: 'item'
    },
    xAxis: chartData.type !== 'pie' ? {
      type: 'category',
      data: chartData.data.map(item => item.name)
    } : undefined,
    yAxis: chartData.type !== 'pie' ? {
      type: 'value'
    } : undefined,
    series: [
      {
        type: chartData.type,
        data: chartData.type === 'pie' ? 
          chartData.data.map(item => ({ 
            name: item.name, 
            value: Number(item.value),
            itemStyle: item.color ? { color: item.color } : undefined
          })) : 
          chartData.type === 'scatter' ?
          chartData.data.map(item => ({
            name: item.name,
            value: [chartData.data.indexOf(item), Number(item.value)],
            itemStyle: item.color ? { color: item.color } : undefined
          })) :
          chartData.data.map((item, index) => ({
            name: item.name,
            value: Number(item.value),
            itemStyle: item.color ? { color: item.color } : undefined
          })),
        radius: chartData.type === 'pie' ? '50%' : undefined,
        itemStyle: chartData.type !== 'pie' ? {
          color: function(params) {
            const item = chartData.data[params.dataIndex];
            return item.color || defaultColors[params.dataIndex % defaultColors.length];
          }
        } : undefined,
        label: chartData.type === 'pie' ? { show: true, formatter: '{b}: {c} ({d}%)' } : undefined
      }
    ]
  };
  
  chartInstance.setOption(option);
};

// 添加新数据
const addData = () => {
  if (editingIndex.value >= 0) {
    // 如果在编辑模式，则保存编辑
    saveEditItem();
  } else if (newDataItem.name && newDataItem.value) {
    // 否则添加新数据
    chartData.data.push({
      name: newDataItem.name,
      value: newDataItem.value,
      color: newDataItem.color
    });
    
    // 清空输入
    newDataItem.name = '';
    newDataItem.value = '';
    // 保持颜色不变或随机选择新颜色
    
    // 更新图表
    updateChart();
  }
};

// 批量添加数据
const addBatchData = () => {
  if (!batchDataInput.value.trim()) {
    ElMessage.warning('请输入批量数据');
    return;
  }
  
  try {
    // 按行分割输入数据
    const lines = batchDataInput.value.trim().split('\n');
    const newDataItems = [];
    
    // 确定分隔符
    let delimiter = ',';
    if (batchDataDelimiter.value === 'tab') {
      delimiter = '\t';
    } else if (batchDataDelimiter.value === 'space') {
      delimiter = ' ';
    } else if (batchDataDelimiter.value === 'auto') {
      // 自动检测分隔符
      const firstLine = lines[0];
      if (firstLine.includes('\t')) {
        delimiter = '\t';
      } else if (firstLine.includes(',')) {
        delimiter = ',';
      } else if (firstLine.includes(' ')) {
        delimiter = ' ';
      }
    }
    
    // 处理每一行数据
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(delimiter);
      if (values.length >= 2) {
        const name = values[0].trim();
        const value = parseFloat(values[1].trim());
        
        if (name && !isNaN(value)) {
          // 使用默认颜色或指定颜色
          const color = values.length >= 3 && values[2].trim() ? 
            values[2].trim() : 
            defaultColors[chartData.data.length % defaultColors.length];
          
          newDataItems.push({
            name,
            value,
            color
          });
        }
      }
    }
    
    if (newDataItems.length > 0) {
      // 添加到图表数据中
      chartData.data = [...chartData.data, ...newDataItems];
      
      // 清空批量输入
      batchDataInput.value = '';
      
      // 更新图表
      updateChart();
      
      ElMessage.success(`成功添加 ${newDataItems.length} 条数据`);
    } else {
      ElMessage.warning('没有有效的数据被添加，请检查输入格式');
    }
  } catch (error) {
    ElMessage.error(`批量添加失败: ${error.message}`);
  }
};

// 批量生成相同数据
const generateSameData = () => {
  if (batchGenerateData.count <= 0) {
    ElMessage.warning('请输入有效的数据数量');
    return;
  }
  
  if (!batchGenerateData.namePrefix) {
    ElMessage.warning('请输入数据名称前缀');
    return;
  }
  
  if (isNaN(batchGenerateData.value) || batchGenerateData.value === '') {
    ElMessage.warning('请输入有效的数值');
    return;
  }
  
  try {
    const newDataItems = [];
    
    // 生成指定数量的数据项
    for (let i = 0; i < batchGenerateData.count; i++) {
      newDataItems.push({
        name: `${batchGenerateData.namePrefix}${i + 1}`,
        value: parseFloat(batchGenerateData.value),
        color: batchGenerateData.color
      });
    }
    
    // 添加到图表数据中
    chartData.data = [...chartData.data, ...newDataItems];
    
    // 更新图表
    updateChart();
    
    ElMessage.success(`成功生成 ${newDataItems.length} 条数据`);
  } catch (error) {
    ElMessage.error(`批量生成失败: ${error.message}`);
  }
};

// 删除数据项
const removeDataItem = (index) => {
  chartData.data.splice(index, 1);
  updateChart();
};

// 更新数据项颜色
const updateItemColor = (index, color) => {
  chartData.data[index].color = color;
  updateChart();
};

// 开始编辑数据项
const startEditItem = (index) => {
  const item = chartData.data[index];
  newDataItem.name = item.name;
  newDataItem.value = item.value;
  newDataItem.color = item.color || defaultColors[index % defaultColors.length];
  editingIndex.value = index;
};

// 保存编辑的数据项
const saveEditItem = () => {
  if (editingIndex.value >= 0 && newDataItem.name && newDataItem.value) {
    chartData.data[editingIndex.value] = {
      name: newDataItem.name,
      value: newDataItem.value,
      color: newDataItem.color
    };
    
    // 清空输入并退出编辑模式
    newDataItem.name = '';
    newDataItem.value = '';
    editingIndex.value = -1;
    
    // 更新图表
    updateChart();
  }
};

// 取消编辑
const cancelEdit = () => {
  newDataItem.name = '';
  newDataItem.value = '';
  editingIndex.value = -1;
};

// 保存当前图表
const saveChart = () => {
  if (!chartData.title) {
    ElMessage.warning('请输入图表标题');
    return;
  }
  
  if (chartData.data.length === 0) {
    ElMessage.warning('请添加数据');
    return;
  }
  
  // 如果是编辑现有图表
  if (currentChartIndex.value >= 0) {
    savedCharts.value[currentChartIndex.value] = JSON.parse(JSON.stringify(chartData));
  } else {
    // 添加新图表
    savedCharts.value.push(JSON.parse(JSON.stringify(chartData)));
  }
  
  // 重置当前编辑状态
  currentChartIndex.value = -1;
  resetChart();
};

// 加载保存的图表
const loadChart = (index) => {
  const chart = savedCharts.value[index];
  chartData.title = chart.title;
  chartData.type = chart.type;
  chartData.data = JSON.parse(JSON.stringify(chart.data));
  currentChartIndex.value = index;
  updateChart();
};

// 删除保存的图表
const deleteChart = (index) => {
  ElMessageBox.confirm(
    '确定要删除这个图表吗？此操作不可恢复。',
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  )
    .then(() => {
      savedCharts.value.splice(index, 1);
      if (currentChartIndex.value === index) {
        resetChart();
      } else if (currentChartIndex.value > index) {
        currentChartIndex.value--;
      }
      ElMessage.success('图表已成功删除');
    })
    .catch(() => {
      // 用户取消删除操作
    });
};

// 重置图表
const resetChart = () => {
  chartData.title = '';
  chartData.type = 'bar';
  chartData.data = [];
  currentChartIndex.value = -1;
  updateChart();
};

// 导入数据
const importData = () => {
  if (fileInput.value) {
    fileInput.value.click();
  }
};

// 处理文件选择
const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      if (importType.value === 'json') {
        // 处理JSON导入
        const importedData = JSON.parse(e.target.result);
        
        if (importedData.title) {
          chartData.title = importedData.title;
        }
        
        if (importedData.type && chartTypes.some(type => type.value === importedData.type)) {
          chartData.type = importedData.type;
        }
        
        if (Array.isArray(importedData.data)) {
          // 确保导入的数据格式正确
          chartData.data = importedData.data.map(item => ({
            name: item.name || '',
            value: item.value || 0,
            color: item.color || ''
          })).filter(item => item.name && item.value);
        }
      } else if (importType.value === 'csv') {
        // 处理CSV导入
        const csvData = e.target.result;
        const lines = csvData.split('\n');
        
        // 假设CSV格式为: name,value,color(可选)
        const headers = lines[0].split(',');
        const hasColorColumn = headers.length > 2 && headers[2].trim().toLowerCase() === 'color';
        
        // 清空现有数据
        chartData.data = [];
        
        // 从第二行开始解析数据（跳过表头）
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = line.split(',');
          if (values.length >= 2) {
            chartData.data.push({
              name: values[0].trim(),
              value: parseFloat(values[1].trim()),
              color: hasColorColumn && values[2] ? values[2].trim() : ''
            });
          }
        }
      }
      
      // 更新图表
      updateChart();
    } catch (error) {
      ElMessage.error(`导入失败: ${error.message}`);
    }
  };
  
  reader.onerror = () => {
    ElMessage.error('读取文件时发生错误');
  };
  
  if (importType.value === 'json') {
    reader.readAsText(file);
  } else if (importType.value === 'csv') {
    reader.readAsText(file);
  }
  
  // 重置文件输入，允许选择相同文件
  event.target.value = '';
};

// 导出数据为JSON
const exportJSON = () => {
  const dataStr = JSON.stringify(chartData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  const exportFileDefaultName = `${chartData.title || 'chart-data'}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
};

// 导出数据为CSV
const exportCSV = () => {
  let csvContent = 'name,value,color\n';
  
  chartData.data.forEach(item => {
    csvContent += `${item.name},${item.value},${item.color || ''}\n`;
  });
  
  const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
  const exportFileDefaultName = `${chartData.title || 'chart-data'}.csv`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
};

// 导出数据为图片
const exportImage = async () => {
  if (!chartInstance) return;
  
  try {
    // 显示加载提示
    const loadingInstance = ElMessage({
      message: '正在生成图片，请稍候...',
      type: 'info',
      duration: 0,
      showClose: true
    });
    
    // 确保图表已经完全渲染
    chartInstance.resize();
    
    // 临时禁用动画效果
    const originalAnimation = chartInstance.getOption().animation;
    chartInstance.setOption({animation: false}, false);
    
    // 等待图表渲染完成，使用Promise确保渲染完成
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 获取图表的数据URL (PNG格式)
    const dataURL = chartInstance.getDataURL({
      type: 'png',
      pixelRatio: 2, // 提高图片质量
      backgroundColor: '#fff'
    });
    
    // 恢复动画设置
    chartInstance.setOption({animation: originalAnimation}, false);
    
    // 关闭加载提示
    loadingInstance.close();
    
    const exportFileDefaultName = `${chartData.title || 'chart-data'}.png`;
    
    // 创建下载链接
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataURL);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    ElMessage.success('图片导出成功');
  } catch (error) {
    console.error('图片导出失败:', error);
    ElMessage.error(`图片导出失败: ${error.message}`);
  }
};

// 一键全部保存（打包下载）
const exportAll = async () => {
  if (!chartData.title) {
    ElMessage.warning('请输入图表标题');
    return;
  }
  
  if (chartData.data.length === 0) {
    ElMessage.warning('请添加数据');
    return;
  }

  try {
    // 显示加载提示
    const loadingInstance = ElMessage({
      message: '正在生成打包文件，请稍候...',
      type: 'info',
      duration: 0,
      showClose: true
    });
    
    // 创建一个新的JSZip实例
    const zip = new JSZip();
    
    // 添加JSON数据
    const jsonData = JSON.stringify(chartData, null, 2);
    zip.file(`${chartData.title}.json`, jsonData);
    
    // 添加CSV数据
    let csvContent = 'name,value,color\n';
    chartData.data.forEach(item => {
      csvContent += `${item.name},${item.value},${item.color || ''}\n`;
    });
    zip.file(`${chartData.title}.csv`, csvContent);
    
    // 保存当前图表类型
    const originalChartType = chartData.type;
    
    // 为当前图表类型生成图片
    if (chartInstance) {
      // 确保图表已经完全渲染
      chartInstance.resize();
      
      // 临时禁用动画效果
      const originalAnimation = chartInstance.getOption().animation;
      chartInstance.setOption({animation: false}, false);
      
      // 等待图表渲染完成
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 获取当前图表的数据URL
      const dataURL = chartInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff'
      });
      
      // 恢复动画设置
      chartInstance.setOption({animation: originalAnimation}, false);
      
      // 将Base64图片数据添加到zip
      const base64Data = dataURL.split(',')[1];
      zip.file(`${chartData.title}.png`, base64Data, {base64: true});
      
      // 为每种图表类型生成图片（可选）
      const generateAllChartTypes = true; // 设置为false可以只导出当前图表类型
      
      if (generateAllChartTypes) {
        // 创建图表类型文件夹
        const chartTypesFolder = zip.folder('其他图表类型');
        
        // 遍历所有图表类型（除了当前类型）
        for (const chartType of chartTypes) {
          if (chartType.value !== originalChartType) {
            // 临时切换图表类型
            chartData.type = chartType.value;
            // 更新图表
            updateChart();
            
            // 临时禁用动画效果
            const typeOriginalAnimation = chartInstance.getOption().animation;
            chartInstance.setOption({animation: false}, false);
            
            // 等待图表渲染完成
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 获取图表的数据URL
            const typeDataURL = chartInstance.getDataURL({
              type: 'png',
              pixelRatio: 2,
              backgroundColor: '#fff'
            });
            
            // 恢复动画设置
            chartInstance.setOption({animation: typeOriginalAnimation}, false);
            
            // 将Base64图片数据添加到zip的图表类型文件夹中
            const typeBase64Data = typeDataURL.split(',')[1];
            chartTypesFolder.file(`${chartData.title}_${chartType.label}.png`, typeBase64Data, {base64: true});
          }
        }
      }
      
      // 恢复原始图表类型
      chartData.type = originalChartType;
      // 更新回原始图表
      updateChart();
    }
    
    // 生成zip文件
    const content = await zip.generateAsync({type: 'blob'});
    
    // 关闭加载提示
    loadingInstance.close();
    
    // 下载zip文件
    const zipFileName = `${chartData.title || 'chart-data'}.zip`;
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(content);
    downloadLink.download = zipFileName;
    downloadLink.click();
    
    ElMessage.success('打包下载成功');
  } catch (error) {
    console.error('打包下载失败:', error);
    ElMessage.error(`打包下载失败: ${error.message}`);
  }
};

// 组件挂载后初始化图表
onMounted(() => {
  initChart();
  
  // 监听窗口大小变化，调整图表大小
  window.addEventListener('resize', () => {
    chartInstance && chartInstance.resize();
  });
});
</script>

<template>
  <div class="chart-container-wrapper">
    <el-container>
      <el-aside width="350px" class="control-panel">
        <el-scrollbar height="100%">
          <el-collapse v-model="activeCollapse" accordion>
            <!-- 图表设置面板 -->
            <el-collapse-item title="图表设置" name="chart-settings">
              <el-form label-position="top" size="small">
                <el-form-item label="图表标题">
                  <el-input 
                    v-model="chartData.title" 
                    placeholder="输入图表标题"
                    clearable
                  />
                </el-form-item>
                
                <el-form-item label="图表类型">
                  <el-select 
                    v-model="chartData.type" 
                    placeholder="选择图表类型" 
                    @change="updateChart"
                    style="width: 100%"
                  >
                    <el-option 
                      v-for="type in chartTypes" 
                      :key="type.value" 
                      :label="type.label" 
                      :value="type.value"
                    />
                  </el-select>
                </el-form-item>
                
                <el-divider content-position="center">导出选项</el-divider>
                
                <el-form-item>
                  <el-button-group>
                    <el-button 
                      type="info" 
                      @click="exportJSON"
                      :icon="Document"
                    >
                      导出JSON
                    </el-button>
                    <el-button 
                      type="info" 
                      @click="exportCSV"
                      :icon="Document"
                    >
                      导出CSV
                    </el-button>
                    <el-button 
                      type="info" 
                      @click="exportImage"
                      :icon="Picture"
                    >
                      导出图片
                    </el-button>
                    <el-button 
                      type="primary" 
                      @click="exportAll"
                      :icon="Download"
                    >
                      一键全部保存
                    </el-button>
                  </el-button-group>
                </el-form-item>
              </el-form>
            </el-collapse-item>
            
            <!-- 数据管理面板 -->
            <el-collapse-item title="数据管理" name="data-management">
              <el-tabs type="border-card" class="data-tabs">
                <el-tab-pane label="单条添加">
                  <el-form label-position="top" size="small">
                    <el-form-item label="名称">
                      <el-input 
                        v-model="newDataItem.name" 
                        placeholder="数据名称"
                        clearable
                      />
                    </el-form-item>
                    
                    <el-form-item label="数值">
                      <el-input-number 
                        v-model="newDataItem.value" 
                        :precision="2"
                        :step="1"
                        style="width: 100%"
                      />
                    </el-form-item>
                    
                    <el-form-item label="颜色">
                      <el-color-picker 
                        v-model="newDataItem.color" 
                        show-alpha
                        :predefine="defaultColors"
                      />
                    </el-form-item>
                    
                    <el-form-item>
                      <div class="form-actions">
                        <el-button 
                          v-if="editingIndex < 0" 
                          type="primary" 
                          @click="addData"
                          :icon="Plus"
                        >
                          添加数据
                        </el-button>
                        <template v-else>
                          <el-button type="success" @click="saveEditItem">保存修改</el-button>
                          <el-button @click="cancelEdit">取消</el-button>
                        </template>
                      </div>
                    </el-form-item>
                  </el-form>
                </el-tab-pane>
                
                <el-tab-pane label="批量添加">
                  <el-form label-position="top" size="small">
                    <el-form-item label="分隔符">
                      <el-select v-model="batchDataDelimiter" style="width: 100%">
                        <el-option label="自动检测" value="auto" />
                        <el-option label=",（逗号）" value="comma" />
                        <el-option label="\t（制表符）" value="tab" />
                        <el-option label="（空格）" value="space" />
                      </el-select>
                    </el-form-item>
                    
                    <el-form-item label="批量数据（每行一条，格式：名称,数值,颜色代码）">
                      <el-input 
                        type="textarea" 
                        v-model="batchDataInput" 
                        :rows="5" 
                        placeholder="示例：\n苹果,120,#ff0000\n香蕉,80,#ffcc00\n橙子,60,#ff9900"
                      />
                    </el-form-item>
                    
                    <el-form-item>
                      <el-button type="primary" @click="addBatchData">批量添加</el-button>
                    </el-form-item>
                  </el-form>
                </el-tab-pane>
                
                <el-tab-pane label="批量生成相同数据">
                  <el-form label-position="top" size="small">
                    <el-form-item label="数据数量">
                      <el-input-number 
                        v-model="batchGenerateData.count" 
                        :min="1"
                        :max="100"
                        :step="1"
                        style="width: 100%"
                      />
                    </el-form-item>
                    
                    <el-form-item label="名称前缀">
                      <el-input 
                        v-model="batchGenerateData.namePrefix" 
                        placeholder="数据名称前缀，将自动添加序号"
                        clearable
                      />
                    </el-form-item>
                    
                    <el-form-item label="数值">
                      <el-input-number 
                        v-model="batchGenerateData.value" 
                        :precision="2"
                        :step="1"
                        style="width: 100%"
                      />
                    </el-form-item>
                    
                    <el-form-item label="颜色">
                      <el-color-picker 
                        v-model="batchGenerateData.color" 
                        show-alpha
                        :predefine="defaultColors"
                      />
                    </el-form-item>
                    
                    <el-form-item>
                      <el-button type="primary" @click="generateSameData">生成数据</el-button>
                    </el-form-item>
                  </el-form>
                </el-tab-pane>
              </el-tabs>
              
              <!-- 当前数据列表 -->
              <div v-if="chartData.data.length > 0" class="data-list-container">
                <el-divider content-position="center">当前数据</el-divider>
                <el-table :data="chartData.data" stripe style="width: 100%" size="small">
                  <el-table-column label="颜色" width="60">
                    <template #default="{row, $index}">
                      <div 
                        class="data-color-preview" 
                        :style="{backgroundColor: row.color || defaultColors[$index % defaultColors.length]}"
                      ></div>
                    </template>
                  </el-table-column>
                  <el-table-column prop="name" label="名称" />
                  <el-table-column prop="value" label="数值" width="80" />
                  <el-table-column label="操作" width="120">
                    <template #default="{row, $index}">
                      <el-button-group size="small">
                        <el-button 
                          type="primary" 
                          :icon="Edit" 
                          @click="startEditItem($index)" 
                          text
                        />
                        <el-color-picker 
                          v-model="row.color" 
                          size="small"
                          @change="(val) => updateItemColor($index, val)"
                        />
                        <el-button 
                          type="danger" 
                          :icon="Delete" 
                          @click="removeDataItem($index)" 
                          text
                        />
                      </el-button-group>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-collapse-item>
            
            <!-- 导入导出面板 -->
            <el-collapse-item title="导入导出" name="import-export">
              <el-form label-position="top" size="small">
                <el-form-item label="导入格式">
                  <el-radio-group v-model="importType">
                    <el-radio-button label="json">JSON</el-radio-button>
                    <el-radio-button label="csv">CSV</el-radio-button>
                  </el-radio-group>
                </el-form-item>
                
                <el-form-item>
                  <el-button 
                    type="primary" 
                    @click="importData"
                    :icon="Upload"
                  >
                    导入数据
                  </el-button>
                  <input 
                    type="file" 
                    ref="fileInput" 
                    @change="handleFileSelect" 
                    style="display: none" 
                    :accept="importType === 'json' ? '.json' : '.csv'"
                  />
                </el-form-item>
              </el-form>
            </el-collapse-item>
            
            <!-- 已保存图表面板 -->
            <el-collapse-item title="已保存图表" name="saved-charts" v-if="savedCharts.length > 0">
              <el-card v-for="(chart, index) in savedCharts" 
                :key="index"
                :class="{ 'active-chart': currentChartIndex === index }"
                shadow="hover"
                class="saved-chart-card"
              >
                <template #header>
                  <div class="saved-chart-header">
                    <span @click="loadChart(index)" class="chart-title">{{ chart.title }}</span>
                    <el-button 
                      type="danger" 
                      :icon="Delete" 
                      @click.stop="deleteChart(index)" 
                      circle
                      size="small"
                    />
                  </div>
                </template>
                <div class="saved-chart-info">
                  <el-tag size="small">{{ chartTypes.find(t => t.value === chart.type)?.label }}</el-tag>
                  <el-tag size="small" type="info">{{ chart.data.length }}个数据点</el-tag>
                </div>
              </el-card>
            </el-collapse-item>
          </el-collapse>
          
          <!-- 主操作按钮区域 -->
          <div class="main-actions">
            <el-button-group>
              <el-button 
                type="success" 
                @click="saveChart"
                size="large"
              >
                保存图表
              </el-button>
              <el-button 
                type="warning" 
                @click="resetChart"
                :icon="Refresh"
                size="large"
              >
                重置
              </el-button>
            </el-button-group>
          </div>
        </el-scrollbar>
      </el-aside>
      
      <el-main class="chart-view">
        <div id="chart-container"></div>
      </el-main>
    </el-container>
  </div>
</template>

<style scoped>
.chart-container-wrapper {
  width: 100%;
  height: 100%;
  min-height: 700px;
  background-color: #f8f9fa;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.control-panel {
  background-color: #fff;
  border-right: 1px solid #eaeaea;
  padding: 0;
}

.chart-view {
  background: linear-gradient(145deg, #f8f9fa 0%, #ffffff 100%);
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#chart-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
  background-color: #fff;
  padding: 16px;
}

/* 折叠面板样式 */
.el-collapse {
  border: none;
  --el-collapse-header-height: 50px;
}

.el-collapse-item {
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
  background-color: #fff;
}

.el-collapse-item__header {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  background-color: #f9fafc;
  padding: 0 16px;
}

.el-collapse-item__content {
  padding: 16px;
}

/* 表单样式 */
.el-form-item {
  margin-bottom: 16px;
}

.el-form-item__label {
  font-weight: 500;
  color: #333;
}

/* 标签页样式 */
.data-tabs {
  margin-bottom: 16px;
}

.el-tabs--border-card {
  box-shadow: none;
  border: 1px solid #eaeaea;
}

/* 数据列表样式 */
.data-list-container {
  margin-top: 20px;
}

.data-color-preview {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  margin: 0 auto;
  border: 1px solid #eee;
}

/* 已保存图表卡片样式 */
.saved-chart-card {
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.saved-chart-card:hover {
  transform: translateY(-2px);
}

.active-chart {
  border-left: 3px solid #409EFF;
  background-color: #ecf5ff;
}

.saved-chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chart-title {
  font-weight: 500;
  cursor: pointer;
  flex: 1;
}

.saved-chart-info {
  display: flex;
  gap: 8px;
}

/* 主操作按钮区域 */
.main-actions {
  margin: 24px 16px;
  display: flex;
  justify-content: center;
}

.main-actions .el-button {
  padding: 12px 24px;
  font-size: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .el-container {
    flex-direction: column;
  }
  
  .el-aside {
    width: 100% !important;
    border-right: none;
    border-bottom: 1px solid #eaeaea;
  }
  
  .main-actions {
    margin: 16px 0;
  }
}

@media (max-width: 768px) {
  .chart-container-wrapper {
    flex-direction: column;
  }
  
  .control-panel {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #eee;
  }
}
</style>