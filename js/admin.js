import { loadSetting, saveSetting, getLogs, clearLogs, getMetrics } from './indexedDB.js';

const ENDPOINT_SETTINGS_KEY = 'VAST_ENDPOINTS';
const DEVICE_ID_SETTINGS_KEY = 'CUSTOM_DEVICE_IDS';

let vastEndpoints = [];
let customDeviceIds = [];

// DOM 元素
const totalPlayCountElement = document.getElementById('total-play-count');
const totalRequestCountElement = document.getElementById('total-request-count');
const cacheHitRateElement = document.getElementById('cache-hit-rate');
const endpointList = document.getElementById('endpoint-list');
const newEndpointNameInput = document.getElementById('new-endpoint-name');
const newEndpointUrlInput = document.getElementById('new-endpoint-url');
const addEndpointBtn = document.getElementById('add-endpoint-btn');
const deviceIdList = document.getElementById('device-id-list');
const newDeviceIdInput = document.getElementById('new-device-id');
const addDeviceIdBtn = document.getElementById('add-device-id-btn');
const clearLogsBtn = document.getElementById('clear-logs-btn');
const logContentDiv = document.getElementById('log-content');
const metricsChartCanvasOverall = document.getElementById('metrics-chart-overall'); // 總覽圖的 canvas
const endpointChartsContainer = document.getElementById('endpoint-charts-container'); // 各 Endpoint 圖表的容器
const cacheChartsContainer = document.getElementById('cache-charts-container'); // 各 Endpoint 快取命中率圖表的容器

async function initAdminPanel() {
    await loadAdminSettings();
    renderEndpoints();
    renderDeviceIds();
    await renderLogs();
    const metrics = await getMetrics();
    renderStats(metrics);
    renderOverallMetricsChart(metrics); // 渲染總覽圖
    renderEndpointCharts(metrics); // 渲染各 Endpoint 圖表
    renderCacheHitRate(metrics);
    renderEndpointCacheCharts(metrics);

    addEndpointBtn.addEventListener('click', addEndpoint);
    addDeviceIdBtn.addEventListener('click', addDeviceId);
    clearLogsBtn.addEventListener('click', clearAllLogs);
}

async function loadAdminSettings() {
    vastEndpoints = (await loadSetting(ENDPOINT_SETTINGS_KEY)) || [];
    customDeviceIds = (await loadSetting(DEVICE_ID_SETTINGS_KEY)) || [];
}

async function saveAdminSettings() {
    await saveSetting(ENDPOINT_SETTINGS_KEY, vastEndpoints);
    await saveSetting(DEVICE_ID_SETTINGS_KEY, customDeviceIds);
}

function renderEndpoints() {
    endpointList.innerHTML = '';
    vastEndpoints.forEach((endpoint, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <div>
                <strong>${endpoint.name}</strong><br>
                <small>${endpoint.url}</small>
            </div>
            <div>
                <button class="btn btn-sm btn-danger delete-endpoint-btn" data-index="${index}">刪除</button>
            </div>
        `;
        endpointList.appendChild(li);
    });
    document.querySelectorAll('.delete-endpoint-btn').forEach(button => {
        button.addEventListener('click', deleteEndpoint);
    });
}

function addEndpoint() {
    const name = newEndpointNameInput.value.trim();
    const url = newEndpointUrlInput.value.trim();
    if (name && url) {
        vastEndpoints.push({ name, url });
        saveAdminSettings();
        renderEndpoints();
        newEndpointNameInput.value = '';
        newEndpointUrlInput.value = '';
    } else {
        alert('請輸入 Endpoint 名稱和 URL。');
    }
}

function deleteEndpoint(event) {
    const index = parseInt(event.target.dataset.index);
    vastEndpoints.splice(index, 1);
    saveAdminSettings();
    renderEndpoints();
}

function renderDeviceIds() {
    deviceIdList.innerHTML = '';
    customDeviceIds.forEach((id, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <span>${id}</span>
            <button class="btn btn-sm btn-danger delete-device-id-btn" data-index="${index}">刪除</button>
        `;
        deviceIdList.appendChild(li);
    });
    document.querySelectorAll('.delete-device-id-btn').forEach(button => {
        button.addEventListener('click', deleteDeviceId);
    });
}

function addDeviceId() {
    const id = newDeviceIdInput.value.trim();
    if (id && !customDeviceIds.includes(id)) {
        customDeviceIds.push(id);
        saveAdminSettings();
        renderDeviceIds();
        newDeviceIdInput.value = '';
    } else if (customDeviceIds.includes(id)) {
        alert('該 Device ID 已存在。');
    } else {
        alert('請輸入 Device ID。');
    }
}

function deleteDeviceId(event) {
    const index = parseInt(event.target.dataset.index);
    customDeviceIds.splice(index, 1);
    saveAdminSettings();
    renderDeviceIds();
}

async function renderLogs() {
    const logs = await getLogs(500); // 取得最新的 500 筆日誌
    logContentDiv.innerHTML = '';
    logs.forEach(log => {
        const logLine = document.createElement('div');
        logLine.className = `log-line ${log.level}`;
        logLine.textContent = `[${new Date(log.timestamp).toLocaleString()}] ${log.message}`;
        if (log.details) {
            const details = document.createElement('pre');
            details.textContent = JSON.stringify(log.details, null, 2);
            logLine.appendChild(details);
        }
        logContentDiv.appendChild(logLine);
    });
    logContentDiv.scrollTop = logContentDiv.scrollHeight; // 滾動到底部
}

async function clearAllLogs() {
    if (confirm('確定要清除所有日誌嗎？此操作無法復原。')) {
        await clearLogs();
        await renderLogs();
        alert('所有日誌已清除。');
    }
}

function renderStats(metrics) {
    const totalPlayCount = metrics.filter(m => m.type === 'AdPlay').length;
    const totalRequestCount = metrics.filter(m => m.type === 'AdRequest').length;
    totalPlayCountElement.textContent = totalPlayCount;
    totalRequestCountElement.textContent = totalRequestCount;
}

// 輔助函數：創建並渲染圖表
function createChart(canvasElement, labels, requestData, playData, errorData, exposureRateData, titleText) {
    new Chart(canvasElement, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '廣告請求 (AdRequest)',
                    data: requestData,
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    fill: true,
                    tension: 0.1
                },
                {
                    label: '廣告播放 (AdPlay)',
                    data: playData,
                    borderColor: '#198754',
                    backgroundColor: 'rgba(25, 135, 84, 0.1)',
                    fill: true,
                    tension: 0.1
                },
                {
                    label: '廣告錯誤 (AdError)',
                    data: errorData,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    fill: true,
                    tension: 0.1
                },
                {
                    label: '曝光率 (%)',
                    data: exposureRateData,
                    borderColor: '#ffc107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    fill: true,
                    tension: 0.1,
                    yAxisID: 'y1' // 使用新的 Y 軸
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: titleText
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '次數'
                    }
                },
                y1: {
                    beginAtZero: true,
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false, // 只繪製左側 Y 軸的網格線
                    },
                    title: {
                        display: true,
                        text: '曝光率 (%)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

// 渲染總覽圖
function renderOverallMetricsChart(metrics) {
    if (!metricsChartCanvasOverall) return; // 確保元素存在

    if (!metrics || metrics.length === 0) {
        metricsChartCanvasOverall.getContext('2d').fillText("沒有足夠的數據來生成總覽圖。", 10, 50);
        return;
    }

    // 按小時匯總數據
    const hourlyData = metrics.reduce((acc, metric) => {
        const hour = new Date(metric.timestamp).getHours();
        const day = new Date(metric.timestamp).toLocaleDateString();
        const key = `${day} ${hour}:00`;

        if (!acc[key]) {
            acc[key] = {
                requests: 0,
                plays: 0,
                errors: 0,
            };
        }

        if (metric.type === 'AdRequest') acc[key].requests++;
        if (metric.type === 'AdPlay') acc[key].plays++;
        if (metric.type === 'AdError') acc[key].errors++;

        return acc;
    }, {});

    // 計算每小時的曝光率
    Object.keys(hourlyData).forEach(key => {
        const data = hourlyData[key];
        data.exposureRate = data.requests > 0 ? (data.plays / data.requests) * 100 : 0;
    });

    const labels = Object.keys(hourlyData).sort();
    const requestData = labels.map(label => hourlyData[label].requests);
    const playData = labels.map(label => hourlyData[label].plays);
    const errorData = labels.map(label => hourlyData[label].errors);
    const exposureRateData = labels.map(label => hourlyData[label].exposureRate);

    createChart(metricsChartCanvasOverall, labels, requestData, playData, errorData, exposureRateData, '每小時廣告事件趨勢與曝光率 (總覽)');
}

// 渲染各 Endpoint 的趨勢圖
function renderEndpointCharts(metrics) {
    if (!endpointChartsContainer) return; // 確保容器存在

    endpointChartsContainer.innerHTML = ''; // 清空現有內容

    const uniqueEndpoints = [...new Set(metrics.map(m => m.endpoint))].filter(e => e !== undefined && e !== null);

    uniqueEndpoints.forEach(endpointName => {
        const endpointMetrics = metrics.filter(m => m.endpoint === endpointName);

        if (endpointMetrics.length === 0) return; // 如果沒有該 Endpoint 的數據，則跳過

        // 按小時匯總數據
        const hourlyData = endpointMetrics.reduce((acc, metric) => {
            const hour = new Date(metric.timestamp).getHours();
            const day = new Date(metric.timestamp).toLocaleDateString();
            const key = `${day} ${hour}:00`;

            if (!acc[key]) {
                acc[key] = {
                    requests: 0,
                    plays: 0,
                    errors: 0,
                };
            }

            if (metric.type === 'AdRequest') acc[key].requests++;
            if (metric.type === 'AdPlay') acc[key].plays++;
            if (metric.type === 'AdError') acc[key].errors++;

            return acc;
        }, {});

        // 計算每小時的曝光率
        Object.keys(hourlyData).forEach(key => {
            const data = hourlyData[key];
            data.exposureRate = data.requests > 0 ? (data.plays / data.requests) * 100 : 0;
        });

        const labels = Object.keys(hourlyData).sort();
        const requestData = labels.map(label => hourlyData[label].requests);
        const playData = labels.map(label => hourlyData[label].plays);
        const errorData = labels.map(label => hourlyData[label].errors);
        const exposureRateData = labels.map(label => hourlyData[label].exposureRate);

        // 創建卡片和 canvas
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card mb-4';
        let tableHtml = `<div class="card-body mt-3">
            <h5>${endpointName} - 每小時數據表格</h5>
            <table class="table table-striped table-sm">
                <thead>
                    <tr>
                        <th>時間</th>
                        <th>請求</th>
                        <th>播放</th>
                        <th>錯誤</th>
                        <th>曝光率 (%)</th>
                    </tr>
                </thead>
                <tbody>`;
        labels.forEach((label, index) => {
            tableHtml += `
                    <tr>
                        <td>${label}</td>
                        <td>${requestData[index]}</td>
                        <td>${playData[index]}</td>
                        <td>${errorData[index]}</td>
                        <td>${exposureRateData[index].toFixed(2)}%</td>
                    </tr>`;
        });
        tableHtml += `
                </tbody>
            </table>
        </div>`;

        cardDiv.innerHTML = `
            <div class="card-header">${endpointName} - 每小時廣告事件趨勢與曝光率</div>
            <div class="card-body">
                <canvas id="metrics-chart-${endpointName.replace(/[^a-zA-Z0-9]/g, '')}"></canvas>
            </div>
            ${tableHtml}
        `;
        endpointChartsContainer.appendChild(cardDiv);

        const canvasElement = cardDiv.querySelector('canvas');
        createChart(canvasElement, labels, requestData, playData, errorData, exposureRateData, `${endpointName} - 每小時廣告事件趨勢與曝光率`);
    });
}

function renderCacheHitRate(metrics) {
    const cacheEvents = metrics.filter(m => m.type === 'CacheEvent');
    const totalCacheEvents = cacheEvents.length;
    const cacheHits = cacheEvents.filter(m => m.status === 'hit').length;

    let hitRate = 0;
    if (totalCacheEvents > 0) {
        hitRate = (cacheHits / totalCacheEvents) * 100;
    }

    if (cacheHitRateElement) {
        cacheHitRateElement.textContent = `${hitRate.toFixed(2)}% (${cacheHits}/${totalCacheEvents})`;
    }
}

function renderEndpointCacheCharts(metrics) {
    if (!cacheChartsContainer) return; // 確保容器存在

    cacheChartsContainer.innerHTML = ''; // 清空現有內容

    const cacheEvents = metrics.filter(m => m.type === 'CacheEvent');
    const uniqueEndpoints = [...new Set(cacheEvents.map(m => m.endpoint))].filter(e => e !== undefined && e !== null);

    uniqueEndpoints.forEach(endpointName => {
        const endpointCacheEvents = cacheEvents.filter(m => m.endpoint === endpointName);

        if (endpointCacheEvents.length === 0) return; // 如果沒有該 Endpoint 的數據，則跳過

        // 按小時匯總數據
        const hourlyData = endpointCacheEvents.reduce((acc, metric) => {
            const hour = new Date(metric.timestamp).getHours();
            const day = new Date(metric.timestamp).toLocaleDateString();
            const key = `${day} ${hour}:00`;

            if (!acc[key]) {
                acc[key] = {
                    hits: 0,
                    misses: 0,
                };
            }

            if (metric.status === 'hit') acc[key].hits++;
            if (metric.status === 'miss') acc[key].misses++;

            return acc;
        }, {});

        // 計算每小時的快取命中率
        Object.keys(hourlyData).forEach(key => {
            const data = hourlyData[key];
            const total = data.hits + data.misses;
            data.hitRate = total > 0 ? (data.hits / total) * 100 : 0;
        });

        const labels = Object.keys(hourlyData).sort();
        const hitData = labels.map(label => hourlyData[label].hits);
        const missData = labels.map(label => hourlyData[label].misses);
        const hitRateData = labels.map(label => hourlyData[label].hitRate);

        // 創建卡片和 canvas
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card mb-4';
        let tableHtml = `<div class="card-body mt-3">
            <h5>${endpointName} - 每小時快取數據表格</h5>
            <table class="table table-striped table-sm">
                <thead>
                    <tr>
                        <th>時間</th>
                        <th>命中</th>
                        <th>未命中</th>
                        <th>命中率 (%)</th>
                    </tr>
                </thead>
                <tbody>`;
        labels.forEach((label, index) => {
            tableHtml += `
                    <tr>
                        <td>${label}</td>
                        <td>${hitData[index]}</td>
                        <td>${missData[index]}</td>
                        <td>${hitRateData[index].toFixed(2)}%</td>
                    </tr>`;
        });
        tableHtml += `
                </tbody>
            </table>
        </div>`;

        cardDiv.innerHTML = `
            <div class="card-header">${endpointName} - 每小時快取命中率趨勢</div>
            <div class="card-body">
                <canvas id="cache-chart-${endpointName.replace(/[^a-zA-Z0-9]/g, '')}"></canvas>
            </div>
            ${tableHtml}
        `;
        cacheChartsContainer.appendChild(cardDiv);

        new Chart(cardDiv.querySelector('canvas'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '快取命中 (Cache Hit)',
                        data: hitData,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: '快取未命中 (Cache Miss)',
                        data: missData,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: '命中率 (%)',
                        data: hitRateData,
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        fill: true,
                        tension: 0.1,
                        yAxisID: 'y1' // 使用新的 Y 軸
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: `${endpointName} - 每小時快取命中率趨勢`
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: '次數'
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false, // 只繪製左側 Y 軸的網格線
                        },
                        title: {
                            display: true,
                            text: '命中率 (%)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    });
}

// 初始化管理面板
initAdminPanel();