// canvas.js (头部)

const { log } = require('./plugin');
const fs = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas'); // 引入新的依赖

// 移除 Puppeteer 和其他不相关的导入，保持文件整洁
// const { launch } = require('puppeteer'); // 移除此行
// ... 其他保持不变

// canvas.js (替换原来的 renderWithCustomFonts 函数)

/**
 * 使用 @napi-rs/canvas 渲染性能信息图像。
 * * @param {object} drawDate - 包含性能数据的对象。
 * @returns {Promise<string|null>} 图像的 data URL (Base64 格式)，如果失败则返回 null。
 */
async function renderWithCustomFonts(drawDate) {
  log.info('开始渲染带自定义字体的图像 (使用 @napi-rs/canvas)');

  const width = 256;
  const height = 256;
  
  // 1. 创建 Canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  try {
    // 字体注册（可选，如果你需要自定义字体）
    // 假设你有一个名为 'MyCustomFont.ttf' 的字体文件
    // const fontPath = resolve(__dirname, 'assets/MyCustomFont.ttf');
    // if (fs.existsSync(fontPath)) {
    //   canvas.registerFont(fontPath, { family: 'CustomFont' });
    // } else {
    //   log.warn('自定义字体文件未找到，将使用默认字体。');
    // }

    // 2. 绘制背景
    ctx.fillStyle = drawDate.backgroundColor || '#aa3c3c'; // 使用默认值
    ctx.fillRect(0, 0, width, height);
    
    // 3. 设置通用的文本样式
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 4. 定义绘图元素的中心 Y 坐标
    // 元素：延迟(Latency)、下载(Download)、上传(Upload)、时间(Time)
    // 垂直方向上，每个元素占据 25% 的高度 (64px)
    const yLatency = 32;   // 0.5 * 64
    const yDownload = 96;  // 1.5 * 64
    const yUpload = 160;   // 2.5 * 64
    const yTime = 224;     // 3.5 * 64
    const centerX = width / 2;

    // --- 绘制 延迟 (Latency) ---
    const latencyText = `​☼ ${drawDate.latency}`; // 使用相似的 Unicode 符号
    ctx.fillStyle = drawDate.latencyColor || '#808080';
    ctx.font = 'bold 42px Arial'; // 模拟原 CSS 的 '42px font-weight: bold'
    ctx.fillText(latencyText, centerX, yLatency);
    
    // --- 绘制 下载 (Download) ---
    const downloadText = `▼ ${drawDate.download}`;
    ctx.fillStyle = drawDate.downloadColor || '#008000';
    ctx.font = 'bold 42px Arial';
    ctx.fillText(downloadText, centerX, yDownload);

    // --- 绘制 上传 (Upload) ---
    const uploadText = `▲ ${drawDate.upload}`;
    ctx.fillStyle = drawDate.uploadColor || '#800080';
    ctx.font = 'bold 42px Arial';
    ctx.fillText(uploadText, centerX, yUpload);

    // --- 绘制 时间 (Time) ---
    const timeText = `${drawDate.time}`;
    ctx.fillStyle = drawDate.timeColor || '#ffffff';
    ctx.font = '48px Arial'; // 模拟原 CSS 的 '48px'
    ctx.fillText(timeText, centerX, yTime);

    // 5. 将 Canvas 转换为 Base64 格式的 PNG 图像
    const base64String = canvas.toDataURL('image/png');
    
    log.info('Canvas 渲染成功，返回 Base64 字符串');
    return base64String;

  } catch (err) {
    log.error('渲染过程出错 (使用 @napi-rs/canvas):', err);
    return null;
  }
}

// canvas.js (底部)

module.exports = {
    // 移除 test
    renderWithCustomFonts
}