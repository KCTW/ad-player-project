import { loadSetting, saveSetting, getLogs, clearLogs } from './indexedDB.js';

const ENDPOINT_SETTINGS_KEY = 'VAST_ENDPOINTS';
const DEVICE_ID_SETTINGS_KEY = 'CUSTOM_DEVICE_IDS';

let vastEndpoints = [];
let customDeviceIds = [];

// DOM 元素
const totalPlayCountElement = document.getElementById('total-play-count');
const totalRequestCountElement = document.getElementById('total-request-count');
const endpointList = document.getElementById('endpoint-list');
const newEndpointNameInput = document.getElementById('new-endpoint-name');
const newEndpointUrlInput = document.getElementById('new-endpoint-url');
const addEndpointBtn = document.getElementById('add-endpoint-btn');
const deviceIdList = document.getElementById('device-id-list');
const newDeviceIdInput = document.getElementById('new-device-id');
const addDeviceIdBtn = document.getElementById('add-device-id-btn');
const clearLogsBtn = document.getElementById('clear-logs-btn');
const logContentDiv = document.getElementById('log-content');

async function initAdminPanel() {
    await loadAdminSettings();
    renderEndpoints();
    renderDeviceIds();
    await renderLogs();
    await renderStats();

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

async function renderStats() {
    const totalPlayCount = (await loadSetting('totalPlayCount')) || 0;
    const totalRequestCount = (await loadSetting('totalRequestCount')) || 0;
    totalPlayCountElement.textContent = totalPlayCount;
    totalRequestCountElement.textContent = totalRequestCount;
}

// 初始化管理面板
initAdminPanel();
