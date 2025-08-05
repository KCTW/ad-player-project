# 廣告播放器專案

這是一個基於 Google IMA SDK 的影片廣告播放器專案，旨在提供一個可配置、具備預載和穩健錯誤處理機制的解決方案。專案經過結構重構，並導入了自動化測試，以確保程式碼品質和功能穩定性。

## 專案概覽

本專案的核心是一個能夠播放 VAST (Video Ad Serving Template) 廣告的播放器。它不僅處理廣告的載入和播放，還包含了使用者設定管理、日誌記錄、以及響應式佈局等功能。

## 專案結構

```
.github/
├── workflows/
│   └── deploy.yml          # GitHub Actions 部署配置
.gitignore                  # Git 忽略文件
package.json                # 專案依賴和腳本
package-lock.json           # 依賴鎖定文件
README.md                   # 專案說明文件
node_modules/               # Node.js 模組 (由 npm 安裝)
src/                        # 專案原始碼
├── index.htm               # 應用程式主頁面 (HTML 結構)
├── js/                     # JavaScript 模組
│   ├── AdPlayer.js         # 核心廣告播放器邏輯
│   ├── indexedDB.js        # IndexedDB 數據存儲工具
│   └── main.js             # 應用程式入口點與 UI 互動邏輯
└── css/                    # CSS 樣式表
    ├── base.css            # 基礎樣式
    ├── components.css      # UI 組件樣式
    └── log-viewer.css      # 日誌檢視器樣式
tests/                      # 測試文件
└── adplayer.test.js        # 廣告播放器整合測試
jest.config.js              # Jest 測試配置
jest-puppeteer.config.js    # Jest Puppeteer 配置 (無頭瀏覽器測試)
jest.setup.js               # Jest 測試設定
```

## 功能特色

*   **VAST 廣告串接**: 遵循 VAST 廣告串接技術規格，支援多種廣告類型。
*   **預載機制**: 實作廣告預載功能，確保廣告播放流暢，減少卡頓。
*   **穩健的錯誤處理**: 內建 VAST 錯誤碼對照表，並具備漸進式延遲重試機制，提高廣告載入成功率。
*   **無限循環播放**: 廣告播放完畢後自動無縫接軌下一則廣告，實現連續播放。
*   **可配置的廣告來源**: 支援多個 VAST Endpoint，使用者可透過 UI 選擇廣告來源。
*   **自訂 Device ID**: 允許使用者自訂設備 ID，方便測試和追蹤。
*   **日誌記錄與檢視**: 將播放日誌儲存到瀏覽器的 IndexedDB，並提供前端日誌檢視器，方便調試。
*   **曝光率追蹤**: 追蹤廣告曝光次數，提供數據分析基礎。
*   **響應式設計**: 支援畫面旋轉時自動調整廣告尺寸，適應不同螢幕方向。
*   **自動化測試**: 導入 Jest 和 Puppeteer 進行整合測試，確保核心功能和 UI 互動的穩定性。
*   **GitHub Pages 部署**: 配置 GitHub Actions 自動部署專案到 GitHub Pages，方便線上預覽。

## 如何運行

### 本地開發環境

1.  **克隆專案**:
    ```bash
    git clone https://github.com/KCTW/ad-player-project.git
    cd ad-player-project
    ```
2.  **安裝依賴**:
    ```bash
    npm install
    ```
3.  **啟動開發伺服器**:
    ```bash
    npx http-server ./src -p 3000
    ```
    然後在瀏覽器中開啟 `http://localhost:3000/index.htm`。

### GitHub Pages 線上預覽

專案會自動部署到 GitHub Pages。您可以透過以下連結訪問：

`https://KCTW.github.io/ad-player-project/` (請將 `KCTW` 替換為您的 GitHub 用戶名)

## 開發指南

### 程式碼風格

請遵循專案中現有的程式碼風格和命名約定。

### 運行測試

在專案根目錄下執行：

```bash
npm test
```

### 擴展功能

*   **新增 VAST Endpoint**: 可以在 `src/js/AdPlayer.js` 的 `VAST_ENDPOINTS` 陣列中添加新的廣告來源。
*   **UI 擴展**: 可以在 `src/index.htm` 中添加新的 UI 元素，並在 `src/js/main.js` 中處理其互動邏輯，樣式則添加到 `src/css/components.css`。

## 授權

[請在此處填寫您的授權資訊，例如 MIT License]
