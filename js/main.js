import AdPlayer from './AdPlayer.js';
import { getLogs, clearLogs, cleanupOldMetrics } from './indexedDB.js';

// 初始化播放器
const player = new AdPlayer();
player.init();
window.player = player;

// 應用程式啟動時，清理超過 7 天的舊監控數據
document.addEventListener('DOMContentLoaded', () => {
    cleanupOldMetrics(7);
});

const showLogsButton = document.getElementById('show-logs-button');
const logViewerContainer = document.getElementById('log-viewer-container');
const closeLogsButton = document.getElementById('close-logs-button');
const logContent = document.getElementById('log-content');

showLogsButton.addEventListener('click', async () => {
    try {
        const logs = await getLogs(200); // 取得最近 200 筆日誌
        logContent.innerHTML = ''; // 清空現有內容
        logs.forEach(log => {
            const logLine = document.createElement('div');
            logLine.className = `log-line ${log.level}`;
            logLine.textContent = `[${new Date(log.timestamp).toLocaleString()}] ${log.message}`;
            if (log.details) {
                const details = document.createElement('pre');
                details.textContent = JSON.stringify(log.details, null, 2);
                logLine.appendChild(details);
            }
            logContent.appendChild(logLine);
        });
        logViewerContainer.style.display = 'flex';
    } catch (error) {
        console.error('Failed to show logs:', error);
        alert('無法顯示日誌，請查看 console。');
    }
});

const clearLogsButton = document.getElementById('clear-logs-button');
clearLogsButton.addEventListener('click', async () => {
    if (confirm('確定要清除所有日誌嗎？')) {
        await clearLogs();
        logContent.innerHTML = ''; // 清空顯示
        alert('日誌已清除。');
    }
});

closeLogsButton.addEventListener('click', () => {
    logViewerContainer.style.display = 'none';
});

const adminPanelButton = document.getElementById('admin-panel-button');
if (adminPanelButton) {
    adminPanelButton.addEventListener('click', () => {
        window.location.href = 'admin.htm';
    });
}

const debugModeToggle = document.getElementById('debug-mode-toggle');
const debugUiContainer = document.getElementById('debug-ui-container');

if (debugModeToggle && debugUiContainer) {
    // 預設開啟除錯 UI
    debugUiContainer.style.display = 'flex';

    debugModeToggle.addEventListener('click', () => {
        if (debugUiContainer.style.display === 'none') {
            debugUiContainer.style.display = 'flex'; // 或 'block'，取決於所需的佈局
        } else {
            debugUiContainer.style.display = 'none';
        }
    });
}
