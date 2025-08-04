/**
 * 廣告播放器
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
    }

    /**
     * 在畫面上顯示一個訊息窗
     * @param {string} message - 要顯示的訊息
     * @param {boolean} isError - 是否為錯誤訊息
     */
    showNotification(message, isError = false) {
        console.log(message); // 仍然在 console 中保留日誌
        const notification = document.createElement('div');
        notification.className = 'notification';
        if (isError) {
            notification.classList.add('error');
        }
        notification.textContent = message;

        this.notificationContainer.appendChild(notification);

        // 5秒後開始淡出，5.5秒後移除
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 5000);
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
    init() {
        this.showNotification("播放器初始化...");
        this.initImaSDK();
        this.playNextAd(); // 開始無限循環
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
        const randomEndpoint = this.VAST_ENDPOINTS[Math.floor(Math.random() * this.VAST_ENDPOINTS.length)];
        this.showNotification(`本次使用 Endpoint: ${randomEndpoint.name}`);

        const url = new URL(randomEndpoint.url);
        const params = {
            device_id: this.PLAYER_CONFIG.DEVICE_ID,
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
                this.showNotification("VAST 預載成功！");
                this.preloadedVastXml = vastXml;
                this.displayVastSummary(vastXml);
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
        if (this.lastAdEndTime > 0) {
            const interval = (Date.now() - this.lastAdEndTime) / 1000;
            let message = `廣告切換耗時: ${interval.toFixed(2)} 秒`;
            if (this.adLoadRetries > 0) {
                message += ` (包含 ${this.adLoadRetries} 次錯誤重試)`;
            }
            this.showNotification(message);
        }
        this.adLoadRetries = 0; // 成功播放，重設重試計數器
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
}

// 當頁面載入完成後，啟動播放器
window.addEventListener('load', () => {
    const player = new AdPlayer();
    player.init();
});