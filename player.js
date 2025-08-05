/**
 * 廣告播放器
 * CI/CD 觸發變更 (由 Gemini 代理添加)
 *
 * - 遵循 VAST 廣告串接技術規格書 v20250528
 * - 實作預載機制以達到順暢播放並避免 stalled
 * - 建立穩健的錯誤處理與無限循環播放
 */
class AdPlayer {
    constructor() {
        // --- 可用的 VAST Endpoints 列表 ---
        this.VAST_ENDPOINTS = [
            { name: "TenMax (原始)", url: 'https://ssp.tenmax.io/supply/outdoor/ad' },
            { name: "Google (範例1)", url: 'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&correlator=' },
            { name: "Google (範例2)", url: 'https://pubads.g.doubleclick.net/gampad/ads?iu=/176265704/pre-roll&description_url=[placeholder]&tfcd=0&npa=0&sz=1920x1080&gdfp_req=1&unviewed_position_start=1&env=vp&impl=s&correlator=' },
            { name: "Google (可略過)", url: 'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=' }
        ];

        // 根據規格書 2.2 節定義請求參數 
        // 建議將這些值從外部設定檔或啟動參數中讀取
        this.PLAYER_CONFIG = {
            DEVICE_ID: 'KC-KC-KC-KC-KC-II',
            RMAXPUBLISHER_ID: '89888e2d53',
            STORE_NUMBER: '00001',
            BUSINESS_HOURS: '0-23', // 24小時 
            AD_ORIENTATION: 'landscape',
            SCREEN_SIZE: 55,
            SCREEN_WIDTH: 129.7, // 規格書範例為 129.7 
            SCREEN_HEIGHT: 121.76,
            LONGITUDE_LATITUDE: '121.564427,25.033671',
            SCREEN_NAME: 'PIC-冰櫃上方-播橫的',
            SCREEN_NOTE: 'PIC-冰櫃上方-播橫的'
        };

        // VAST 錯誤碼對照表
        this.VAST_ERROR_MAP = {
            100: 'XML parsing error.',
            101: 'VAST schema validation error.',
            200: 'Trafficking error. Video player received an ad type that it was not expecting.',
            201: 'Video player expecting different linearity.',
            202: 'Video player expecting different duration.',
            203: 'Video player expecting different size.',
            300: 'General Wrapper error.',
            301: 'Timeout of VAST URI provided in Wrapper element.',
            302: 'Wrapper limit reached, as defined by the video player.',
            303: 'No ads VAST response after one or more Wrappers.',
            400: 'General Linear error. Player is unable to display the Linear ad.',
            401: 'File not found. Unable to find Linear/MediaFile from URI.',
            402: 'Timeout of MediaFile URI.',
            403: 'Could not find MediaFile that is supported by this video player.',
            405: 'Problem displaying MediaFile. Video player found a MediaFile with a valid type but couldn’t display it.',
            500: 'General NonLinearAds error.',
            501: 'Unable to display NonLinear ad because creative dimensions do not align with creative display area.',
            502: 'Unable to fetch NonLinearAds/NonLinear resource.',
            503: 'Could not find NonLinear resource with a supported type.',
            600: 'General CompanionAds error.',
            601: 'Unable to display Companion because creative dimensions do not align with the creative display area.',
            602: 'Unable to display required Companion.',
            603: 'Unable to fetch CompanionAds/Companion resource.',
            604: 'Could not find Companion resource with a supported type.',
            900: 'Undefined VAST 3 error.',
            901: 'General VAST 4 error.'
        };

        // DOM 元素
        this.adContainer = document.getElementById('ad-container');
        this.contentElement = document.getElementById('content-element');
        this.notificationContainer = document.getElementById('notification-container');

        // IMA SDK 核心物件
        this.adDisplayContainer = null;
        this.adsLoader = null;
        this.adsManager = null;

        // 預載與循環播放相關的狀態
        this.preloadedVastXml = null;
        this.isPreloadTriggered = false; //確保一則廣告只觸發一次預載
        this.lastReportedProgress = 0; // 用於追踪播放進度報告
        this.lastAdEndTime = 0; // 用於測量廣告間隔
        this.adLoadRetries = 0; // 用於計算錯誤重試次數
        this.endpointFailureCounts = {}; // 追蹤每個 Endpoint 的連續失敗次數
        this.currentAdTagUrl = null; // 當前請求的 Ad Tag URL

        // 曝光率相關
        this.adStartTimestamps = []; // 儲存廣告開始播放的時間戳
        this.tenMinuteExposureHistory = []; // 儲存十分鐘區間的曝光歷史
        this.exposureDisplayElement = null; // 顯示曝光率的 DOM 元素
        this.playRequestDisplayElement = null; // 顯示總播放/請求次數的 DOM 元素
        this.totalPlayCount = 0; // 總播放次數
        this.totalRequestCount = 0; // 總請求次數
        this.selectedEndpoints = []; // 用於儲存使用者選擇的 Endpoint 名稱
        this.customDeviceId = ''; // 用於儲存使用者自訂的 Device ID
        this.reportedVideoResources = new Set(); // 用於追蹤已報告的影片資源，避免重複顯示快取訊息

        // 異步載入設定
        this.loadSettings().then(() => {
            // 設定載入完成後，渲染 UI
            this.renderEndpointSelection();
            this.renderDeviceIdInput();
        });
    }

    async loadSettings() {
        this.selectedEndpoints = (await loadSetting('selectedEndpoints')) || [];
        this.customDeviceId = (await loadSetting('customDeviceId')) || '';
    }

    /**
     * 在畫面上顯示一個訊息窗
     * @param {string} message - 要顯示的訊息
     * @param {boolean} isError - 是否為錯誤訊息
     */
    showNotification(message, isError = false, isCache = false) {
        console.log(message); // 仍然在 console 中保留日誌
        const notification = document.createElement('div');
        notification.className = 'notification';
        if (isError) {
            notification.classList.add('error');
        }
        if (isCache) {
            notification.classList.add('cache-info');
        }
        notification.textContent = message;

        this.notificationContainer.appendChild(notification);

        // 8秒後開始淡出，8.5秒後移除
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 8000);
    }

    /**
     * 解析並顯示 VAST XML 的摘要資訊
     * @param {string} vastXml - VAST XML 字串
     */
    displayVastSummary(vastXml) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(vastXml, "text/xml");

            const adNode = xmlDoc.querySelector("Ad");
            const adId = adNode ? adNode.getAttribute("id") : "N/A";

            const adTitleNode = xmlDoc.querySelector("AdTitle");
            const mediaFileNode = xmlDoc.querySelector("MediaFile");

            const title = adTitleNode ? adTitleNode.textContent.trim() : "N/A";
            const mediaFile = mediaFileNode ? mediaFileNode.textContent.trim() : "N/A";
            
            // 使用換行符 `\n` 來分隔多行訊息
            const summary = `VAST 摘要:\n` +
                            `廣告 ID: ${adId}\n` +
                            `標題: ${title}\n` +
                            `影片: ${mediaFile}`;

            this.showNotification(summary);
        } catch (e) {
            this.showNotification("解析 VAST XML 摘要時出錯", true);
        }
    }

    /**
     * 初始化播放器
     */
    async init() {
        this.showNotification("播放器初始化...");
        await this.loadSettings(); // 等待設定載入完成
        this.initImaSDK();
        this.playNextAd(); // 開始無限循環
        this.exposureDisplayElement = document.getElementById('exposure-rate');
        this.playRequestDisplayElement = document.getElementById('play-request-counts');
        this.updateExposureDisplay(); // 初始化曝光率顯示
        this.updatePlayRequestDisplay(); // 初始化總播放/請求次數顯示
    }

    /**
     * 初始化 Google IMA SDK 元件
     */
    initImaSDK() {
        this.adDisplayContainer = new google.ima.AdDisplayContainer(this.adContainer, this.contentElement);

        this.adsLoader = new google.ima.AdsLoader(this.adDisplayContainer);
        this.adsLoader.addEventListener(
            google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
            (e) => this.onAdsManagerLoaded(e),
            false
        );
        this.adsLoader.addEventListener(
            google.ima.AdErrorEvent.Type.AD_ERROR,
            (e) => this.onAdError(e),
            false
        );
    }

    /**
     * 根據規格書建構 VAST 請求 URL [cite: 3, 5]
     * @returns {string} 完整的請求 URL
     */
    buildVastUrl() {
        let availableEndpoints = this.VAST_ENDPOINTS;
        if (this.selectedEndpoints.length > 0) {
            availableEndpoints = this.VAST_ENDPOINTS.filter(endpoint => this.selectedEndpoints.includes(endpoint.name));
        }

        if (availableEndpoints.length === 0) {
            this.showNotification("沒有可用的 Endpoint，請至少選擇一個。", true);
            return null; // 返回 null，表示無法構建 URL
        }

        const randomEndpoint = availableEndpoints[Math.floor(Math.random() * availableEndpoints.length)];
        this.showNotification(`本次使用 Endpoint: ${randomEndpoint.name}`);

        const url = new URL(randomEndpoint.url);
        const params = {
            device_id: this.customDeviceId || this.PLAYER_CONFIG.DEVICE_ID,
            rmaxpublisher_id: this.PLAYER_CONFIG.RMAXPUBLISHER_ID,
            store_number: this.PLAYER_CONFIG.STORE_NUMBER,
            business_hours: this.PLAYER_CONFIG.BUSINESS_HOURS,
            ad_orientation: this.PLAYER_CONFIG.AD_ORIENTATION,
            screen_size: this.PLAYER_CONFIG.SCREEN_SIZE,
            screen_width: this.PLAYER_CONFIG.SCREEN_WIDTH,
            screen_height: this.PLAYER_CONFIG.SCREEN_HEIGHT,
            longitude_latitude: this.PLAYER_CONFIG.LONGITUDE_LATITUDE,
            screen_name: '廣告播放器',
            screen_note: '廣告播放器'
        };

        // 將參數附加到 URL
        for (const key in params) {
            url.searchParams.append(key, params[key]);
        }
        
        this.currentAdTagUrl = url.toString(); // 記錄當前請求的 URL
        this.totalRequestCount++; // 每次構建 URL 都視為一次請求
        this.updatePlayRequestDisplay(); // 更新顯示
        return this.currentAdTagUrl;
    }

    /**
     * 請求並播放下一個廣告
     */
    playNextAd() {
        this.showNotification("準備播放下一則廣告...");
        // 重置預載與進度旗標
        this.isPreloadTriggered = false;
        this.lastReportedProgress = 0;

        const adsRequest = new google.ima.AdsRequest();

        if (this.preloadedVastXml) {
            this.showNotification("使用已預載的 VAST 資料播放。");
            adsRequest.adsResponse = this.preloadedVastXml;
            this.preloadedVastXml = null; // 使用後清空
        } else {
            this.showNotification("發出新的 VAST 請求。");
            adsRequest.adTagUrl = this.buildVastUrl();
        }
        
        // 這是 IMA SDK 播放廣告的標準流程
        this.adsLoader.requestAds(adsRequest);
    }
    
    /**
     * 規格書要求：預載下一個 VAST 
     * 採用 fetch API 非同步取得 VAST XML，不干擾當前播放
     */
    preloadNextAd() {
        this.showNotification("開始預載下一則廣告的 VAST...");
        const nextAdUrl = this.buildVastUrl();

        fetch(nextAdUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`預載失敗: HTTP status ${response.status}`);
                }
                return response.text();
            })
            .then(vastXml => {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(vastXml, "text/xml");
                const adNodes = xmlDoc.querySelectorAll("Ad");

                if (adNodes.length > 0) {
                    this.showNotification("VAST 預載成功！");
                    this.preloadedVastXml = vastXml;
                    this.displayVastSummary(vastXml);
                } else {
                    this.showNotification("VAST 預載失敗：沒有廣告內容。", true);
                    this.preloadedVastXml = null; // 確保預載失敗時，狀態是乾淨的
                    // 觸發錯誤處理流程，而不是直接播放下一則廣告
                    this.onAdError({ getError: () => ({ getVastErrorCode: () => 303, getMessage: () => 'No ads VAST response after one or more Wrappers.' }) });
                }
            })
            .catch(error => {
                this.showNotification(`預載下一則 VAST 時發生錯誤: ${error}`, true);
                this.preloadedVastXml = null; // 確保預載失敗時，狀態是乾淨的
            });
    }

    /**
     * AdsLoader 成功取得廣告後的回呼
     */
    onAdsManagerLoaded(adsManagerLoadedEvent) {
        this.showNotification("AdsManager 已載入。");
        // 成功載入，重設對應 Endpoint 的失敗計數器
        if (this.currentAdTagUrl) {
            this.endpointFailureCounts[this.currentAdTagUrl] = 0;
        }

        this.adsManager = adsManagerLoadedEvent.getAdsManager(this.contentElement);

        // --- 加入新的事件監聽 ---
        this.adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, () => this.onAdStarted());
        this.adsManager.addEventListener(google.ima.AdEvent.Type.AD_PROGRESS, (e) => this.onAdProgress(e));
        this.adsManager.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED, () => this.onAllAdsCompleted());
        this.adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, (e) => this.onAdError(e));
        
        try {
            // 開始播放廣告
            this.adDisplayContainer.initialize();
            this.adsManager.init(window.innerWidth, window.innerHeight, google.ima.ViewMode.FULLSCREEN);
            this.adsManager.start();
        } catch (adError) {
            this.showNotification(`AdsManager 啟動失敗: ${adError}`, true);
            this.playNextAd(); // 發生錯誤，立即嘗試播放下一則
        }
    }

    /**
     * 廣告影片真正開始播放時觸發
     */
    onAdStarted() {
        this.reportedVideoResources.clear(); // 清空已報告的影片資源，確保每次廣告播放都重新檢查
        if (this.lastAdEndTime > 0) {
            const interval = (Date.now() - this.lastAdEndTime) / 1000;
            let message = `廣告切換耗時: ${interval.toFixed(2)} 秒`;
            if (this.adLoadRetries > 0) {
                message += ` (包含 ${this.adLoadRetries} 次錯誤重試)`;
            }
            this.showNotification(message);
        }
        this.adLoadRetries = 0; // 成功播放，重設重試計數器
        this.totalPlayCount++; // 增加總播放次數

        // 更新十分鐘曝光歷史
        const now = new Date();
        const currentMinute = now.getMinutes();
        const currentHour = now.getHours();
        const tenMinuteInterval = Math.floor(currentMinute / 10);
        const key = `${currentHour.toString().padStart(2, '0')}:${(tenMinuteInterval * 10).toString().padStart(2, '0')}`;

        let found = false;
        for (let i = 0; i < this.tenMinuteExposureHistory.length; i++) {
            if (this.tenMinuteExposureHistory[i].key === key) {
                this.tenMinuteExposureHistory[i].count++;
                found = true;
                break;
            }
        }
        if (!found) {
            this.tenMinuteExposureHistory.push({ key: key, count: 1, timestamp: now.getTime() });
        }

        // 保持最多三個區間的歷史記錄
        this.tenMinuteExposureHistory.sort((a, b) => b.timestamp - a.timestamp);
        if (this.tenMinuteExposureHistory.length > 3) {
            this.tenMinuteExposureHistory = this.tenMinuteExposureHistory.slice(0, 3);
        }

        this.updateExposureDisplay(); // 更新曝光率顯示
        this.updatePlayRequestDisplay(); // 更新總播放/請求次數顯示
        // 延遲檢查媒體快取使用情況，給瀏覽器一些時間更新 Performance API 數據
        setTimeout(() => {
            this.checkMediaCacheUsage();
        }, 500); // 延遲 500 毫秒
    }

    /**
     * 檢查廣告媒體是否使用了本地快取
     */
    checkMediaCacheUsage() {
        if (window.performance && window.performance.getEntriesByType) {
            const resources = window.performance.getEntriesByType('resource');
            const videoResources = resources.filter(resource =>
                resource.initiatorType === 'video' ||
                (resource.name.endsWith('.mp4') || resource.name.endsWith('.webm') || resource.name.endsWith('.mov'))
            );

            if (videoResources.length > 0) {
                videoResources.forEach(resource => {
                    const resourceBaseName = resource.name.split('?')[0]; // 移除查詢參數，確保唯一性
                    // 檢查是否已經報告過這個影片資源的快取狀態
                    if (this.reportedVideoResources.has(resourceBaseName)) {
                        return; // 如果已經報告過，則跳過
                    }

                    let cacheStatus = '未知';
                    if (resource.transferSize === 0) {
                        cacheStatus = '已從瀏覽器快取載入';
                    } else if (resource.transferSize > 0) {
                        if (resource.transferSize < resource.decodedBodySize) {
                            cacheStatus = `直接從網路載入 (已壓縮: ${resource.transferSize} / ${resource.decodedBodySize} bytes)`;
                        } else {
                            cacheStatus = `直接從網路載入 (未壓縮: ${resource.transferSize} bytes)`;
                        }
                    }

                    this.showNotification(`影片 ${resource.name.substring(resource.name.lastIndexOf('/') + 1)}: ${cacheStatus}`, false, true);
                    this.reportedVideoResources.add(resourceBaseName); // 記錄已報告的影片資源 (使用處理後的名稱)
                });
            } else {
                this.showNotification("未偵測到影片資源或 Performance API 未提供詳細資訊。");
            }
        } else {
            this.showNotification("瀏覽器不支援 Performance API 或 getEntriesByType('resource')，無法檢查快取使用情況。");
        }
    }

    /**
     * 廣告進度更新事件
     */
    onAdProgress(adProgressEvent) {
        const adData = adProgressEvent.getAdData();
        const progress = adData.currentTime / adData.duration;
        const progressPercent = progress * 100;

        // --- 視覺化播放進度里程碑 ---
        const milestones = {
            0: "廣告開始播放 (start)",
            25: "第一四分位 (firstQuartile)",
            50: "播放至一半 (midpoint)",
            75: "第三四分位 (thirdQuartile)"
        };

        for (const point in milestones) {
            if (progressPercent >= point && this.lastReportedProgress < point) {
                this.showNotification(`播放進度: ${milestones[point]}`);
                this.lastReportedProgress = parseInt(point, 10);
            }
        }

        // --- 預載邏輯 (保留) ---
        // 根據規格書 4.2，在 75% 時預載下一則廣告 
        // 並確保只觸發一次
        if (progress > 0.75 && !this.isPreloadTriggered) {
            this.isPreloadTriggered = true; // 標記已觸發，防止重複執行
            this.preloadNextAd();
        }
    }

    /**
     * 所有廣告播放完畢，準備進入下一輪循環
     */
    onAllAdsCompleted() {
        this.showNotification("本則廣告播放完畢。");
        this.lastAdEndTime = Date.now(); // 記錄廣告結束時間
        this.updateExposureDisplay(); // 廣告播放結束時更新曝光率
        this.updatePlayRequestDisplay(); // 廣告播放結束時更新總播放/請求次數
        if(this.adsManager) {
            this.adsManager.destroy(); // 銷毀舊的 manager
        }
        this.playNextAd(); // 無縫接軌下一則
    }

    /**
     * 廣告錯誤處理
     */
    onAdError(adErrorEvent) {
        this.adLoadRetries++; // 每次錯誤，重試次數加一

        // 取得當前 Endpoint 的連續失敗次數
        const adTagUrl = this.currentAdTagUrl;
        if (adTagUrl) {
            this.endpointFailureCounts[adTagUrl] = (this.endpointFailureCounts[adTagUrl] || 0) + 1;
        }
        const failureCount = this.endpointFailureCounts[adTagUrl] || 1;

        const error = adErrorEvent.getError();
        const errorCode = error.getVastErrorCode();
        const errorMessage = this.VAST_ERROR_MAP[errorCode] || error.getMessage();

        const fullMessage = `廣告錯誤 (Code: ${errorCode})\n${errorMessage}`;
        this.showNotification(fullMessage, true);
        this.updatePlayRequestDisplay(); // 錯誤時也更新總播放/請求次數

        if (this.adsManager) {
            this.adsManager.destroy();
        }

        // --- 漸進式延遲 ---
        const baseDelay = 500; // 0.5秒基本延遲
        const maxDelay = 10000; // 10秒最大延遲
        const delay = Math.min(baseDelay * failureCount, maxDelay);

        this.showNotification(`Endpoint 連續失敗 ${failureCount} 次，本次延遲 ${delay / 1000} 秒後重試...`);
        setTimeout(() => {
            this.playNextAd();
        }, delay);
    }

    /**
     * 渲染 Endpoint 選擇器
     */
    renderEndpointSelection() {
        const container = document.getElementById('endpoint-selection-container');
        if (!container) return;

        container.innerHTML = ''; // 清空現有內容

        const title = document.createElement('div');
        title.textContent = '選擇廣告來源:';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '5px';
        container.appendChild(title);

        this.VAST_ENDPOINTS.forEach(endpoint => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = endpoint.name;
            checkbox.checked = this.selectedEndpoints.includes(endpoint.name); // 根據已選擇的狀態設定

            checkbox.addEventListener('change', async (event) => {
                if (event.target.checked) {
                    this.selectedEndpoints.push(endpoint.name);
                } else {
                    this.selectedEndpoints = this.selectedEndpoints.filter(name => name !== endpoint.name);
                }
                await saveSetting('selectedEndpoints', this.selectedEndpoints); // 儲存設定
                // 重新啟動播放，以使用新的選擇
                this.playNextAd();
            });

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(endpoint.name));
            container.appendChild(label);
            container.appendChild(document.createElement('br'));
        });
    }

    /**
     * 渲染 Device ID 輸入欄位
     */
    renderDeviceIdInput() {
        const container = document.getElementById('device-id-input-container');
        if (!container) return;

        container.innerHTML = ''; // 清空現有內容

        const title = document.createElement('div');
        title.textContent = '自訂 Device ID:';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '5px';
        container.appendChild(title);

        // 下拉選單
        const select = document.createElement('select');
        const deviceIds = [
            '', // 預設空值，表示使用 PLAYER_CONFIG 中的 DEVICE_ID
            'KC-KC-KC-KC-KC-II',
            '0K37HNCWB00068Z',
            '0K37HNCW600099K',
            '0K37HNCW600098J',
            '0K37HNCW600091Z',
            '0QY0HNCX300122K',
            '07YZHNBNB00088R',
            'c279508081931351',
            '4ae0f8bc725bb311'
        ];

        deviceIds.forEach(id => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = id === '' ? '使用預設 (KC-KC-KC-KC-KC-II)' : id;
            select.appendChild(option);
        });

        select.value = this.customDeviceId; // 設定選單的預設值
        select.addEventListener('change', async (event) => {
            this.customDeviceId = event.target.value.trim();
            this.showNotification(`Device ID 已設定為: ${this.customDeviceId || '預設'}`);
            await saveSetting('customDeviceId', this.customDeviceId); // 儲存設定
            this.playNextAd(); // 重新啟動播放，以使用新的 Device ID
        });
        container.appendChild(select);

        // 手動輸入框
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '或手動輸入 Device ID';
        input.value = this.customDeviceId; // 顯示當前值
        input.style.marginTop = '5px';
        input.addEventListener('change', async (event) => {
            this.customDeviceId = event.target.value.trim();
            this.showNotification(`Device ID 已設定為: ${this.customDeviceId || '預設'}`);
            await saveSetting('customDeviceId', this.customDeviceId); // 儲存設定
            this.playNextAd(); // 重新啟動播放，以使用新的 Device ID
        });
        container.appendChild(input);
    }

    /**
     * 更新畫面上的曝光率顯示 (最近三個十分鐘區間)
     */
    updateExposureDisplay() {
        if (this.exposureDisplayElement) {
            let displayContent = "";
            if (this.tenMinuteExposureHistory.length === 0) {
                displayContent = "近十分鐘曝光: 0 次"; // Default message if no data
            } else {
                // Sort by timestamp descending and take the top 3
                const sortedHistory = [...this.tenMinuteExposureHistory].sort((a, b) => b.timestamp - a.timestamp);
                for (let i = 0; i < Math.min(sortedHistory.length, 3); i++) {
                    const item = sortedHistory[i];
                    displayContent += `${item.key} - ${item.count} 次\n`;
                }
            }
            this.exposureDisplayElement.textContent = displayContent.trim();
        }
    }

    /**
     * 更新畫面上的總播放次數和請求次數顯示
     */
    updatePlayRequestDisplay() {
        if (this.playRequestDisplayElement) {
            this.playRequestDisplayElement.textContent = `總播放/請求: ${this.totalPlayCount} / ${this.totalRequestCount}`;
        }
    }
}

// IndexedDB 相關工具函數
const DB_NAME = 'AdPlayerDB';
const DB_VERSION = 1;
const STORE_NAME = 'settings';

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

async function saveSetting(key, value) {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(value, key);
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.errorCode);
    });
}

async function loadSetting(key) {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.errorCode);
    });
}

// 當頁面載入完成後，啟動播放器
window.addEventListener('load', () => {
    const player = new AdPlayer();
    player.init();
});