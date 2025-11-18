/**
 * QRコード生成と出退勤管理のメインスクリプト
 * JWT トークンを生成し、QRコードとして表示する機能を提供
 */

import * as jose from 'https://cdn.jsdelivr.net/npm/jose@5.2.0/+esm';

// グローバル変数
let currentQRCode = null;  // 現在表示中のQRコードオブジェクト
let qrTimer = null;  // QRコード自動消去タイマー
let qrStartTime = null;  // QRコード表示開始時刻
let timerInterval = null;  // タイマー表示更新用インターバル

/**
 * ログをコンソールとUI両方に出力する
 * @param {string} message - ログメッセージ
 * @param {string} type - ログの種類 ('info', 'error', 'success')
 */
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    const logDisplay = document.getElementById('logDisplay');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    logDisplay.appendChild(logEntry);
    logDisplay.scrollTop = logDisplay.scrollHeight;
    console.log(`[${type.toUpperCase()}] ${message}`);
}

/**
 * LocalStorageから設定を読み込む
 * @returns {Object} 設定オブジェクト
 */
function loadSettings() {
    const settings = {
        deviceId: localStorage.getItem('deviceId') || '',
        passcode: localStorage.getItem('passcode') || '',
        serverUrl: localStorage.getItem('serverUrl') || ''
    };
    
    // UIに反映
    document.getElementById('deviceId').value = settings.deviceId;
    document.getElementById('passcode').value = settings.passcode;
    document.getElementById('serverUrl').value = settings.serverUrl;
    
    addLog('設定を読み込みました');
    return settings;
}

/**
 * LocalStorageに設定を保存する
 */
function saveSettings() {
    const deviceId = document.getElementById('deviceId').value.trim();
    const passcode = document.getElementById('passcode').value;
    const serverUrl = document.getElementById('serverUrl').value.trim();
    
    if (!deviceId || !passcode || !serverUrl) {
        addLog('すべての設定項目を入力してください', 'error');
        alert('すべての設定項目を入力してください');
        return false;
    }
    
    localStorage.setItem('deviceId', deviceId);
    localStorage.setItem('passcode', passcode);
    localStorage.setItem('serverUrl', serverUrl);
    
    addLog('設定を保存しました', 'success');
    alert('設定を保存しました');
    return true;
}

/**
 * JWTトークンを生成する
 * @param {string} deviceId - デバイスID
 * @param {string} passcode - パスコード（秘密鍵として使用）
 * @param {string} action - 出勤/退勤 ('clockIn' or 'clockOut')
 * @returns {Promise<string>} JWT トークン
 */
async function generateToken(deviceId, passcode, action) {
    try {
        const timestamp = Date.now();
        const expirationTime = Math.floor(timestamp / 1000) + (3 * 60); // 3分後
        
        // ペイロード作成
        const payload = {
            deviceId: deviceId,
            action: action,
            timestamp: timestamp,
            exp: expirationTime
        };
        
        // パスコードから鍵を生成（HMAC-SHA256）
        const secret = new TextEncoder().encode(passcode);
        
        // JWTを署名
        const token = await new jose.SignJWT(payload)
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime(expirationTime)
            .sign(secret);
        
        addLog(`トークン生成成功: ${action}`, 'success');
        return token;
    } catch (error) {
        addLog(`トークン生成エラー: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * QRコードを表示する
 * @param {string} action - 出勤/退勤 ('clockIn' or 'clockOut')
 */
async function displayQRCode(action) {
    // 設定の読み込み
    const deviceId = localStorage.getItem('deviceId');
    const passcode = localStorage.getItem('passcode');
    const serverUrl = localStorage.getItem('serverUrl');
    
    if (!deviceId || !passcode || !serverUrl) {
        addLog('設定が不完全です。設定を保存してください', 'error');
        alert('設定が不完全です。先に設定を保存してください。');
        return;
    }
    
    // 既存のQRコードをクリア
    clearQRCode();
    
    try {
        // トークン生成
        const token = await generateToken(deviceId, passcode, action);
        
        // URLの構築
        const qrUrl = `${serverUrl}?token=${token}`;
        
        // QRコードの色を設定（出勤=青、退勤=赤）
        const colorDark = action === 'clockIn' ? '#2F80ED' : '#F5576C';
        const colorLight = '#ffffff';
        
        // QRコード生成
        const qrcodeContainer = document.getElementById('qrcode');
        qrcodeContainer.innerHTML = ''; // クリア
        
        currentQRCode = new QRCode(qrcodeContainer, {
            text: qrUrl,
            width: 250,
            height: 250,
            colorDark: colorDark,
            colorLight: colorLight,
            correctLevel: QRCode.CorrectLevel.L
        });
        
        // ステータス表示
        const statusText = action === 'clockIn' ? '出勤' : '退勤';
        document.getElementById('qrStatus').textContent = `${statusText}のQRコードを表示中`;
        document.getElementById('qrStatus').style.color = colorDark;
        
        // URL表示
        const qrUrlDisplay = document.getElementById('qrUrlDisplay');
        qrUrlDisplay.innerHTML = `<a href="${qrUrl}" target="_blank" rel="noopener noreferrer">${qrUrl}</a>`;
        qrUrlDisplay.style.display = 'block';
        
        addLog(`${statusText}のQRコードを生成しました`, 'success');
        
        // タイマー開始
        qrStartTime = Date.now();
        startQRTimer();
        
        // 1分後に自動消去
        qrTimer = setTimeout(() => {
            clearQRCode();
            addLog('QRコードが1分経過したため消去されました', 'info');
        }, 60 * 1000);
        
    } catch (error) {
        addLog(`QRコード生成に失敗しました: ${error.message}`, 'error');
    }
}

/**
 * QRコードのタイマー表示を更新する
 */
function startQRTimer() {
    const timerDisplay = document.getElementById('qrTimer');
    
    timerInterval = setInterval(() => {
        if (!qrStartTime) {
            clearInterval(timerInterval);
            timerDisplay.textContent = '';
            return;
        }
        
        const elapsed = Math.floor((Date.now() - qrStartTime) / 1000);
        const remaining = 60 - elapsed;
        
        if (remaining > 0) {
            timerDisplay.textContent = `残り ${remaining} 秒`;
        } else {
            timerDisplay.textContent = '';
            clearInterval(timerInterval);
        }
    }, 1000);
}

/**
 * QRコードをクリアする
 */
function clearQRCode() {
    const qrcodeContainer = document.getElementById('qrcode');
    qrcodeContainer.innerHTML = '';
    currentQRCode = null;
    
    if (qrTimer) {
        clearTimeout(qrTimer);
        qrTimer = null;
    }
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    qrStartTime = null;
    
    document.getElementById('qrStatus').textContent = 'ボタンをタップしてQRコードを生成';
    document.getElementById('qrStatus').style.color = '#666';
    document.getElementById('qrTimer').textContent = '';
    
    // URL表示をクリア
    const qrUrlDisplay = document.getElementById('qrUrlDisplay');
    qrUrlDisplay.innerHTML = '';
    qrUrlDisplay.style.display = 'none';
}

/**
 * 初期化処理
 */
function init() {
    addLog('アプリケーションを初期化しています...', 'info');
    
    // 設定の読み込み
    loadSettings();
    
    // イベントリスナーの設定
    document.getElementById('clockInBtn').addEventListener('click', () => {
        displayQRCode('clockIn');
    });
    
    document.getElementById('clockOutBtn').addEventListener('click', () => {
        displayQRCode('clockOut');
    });
    
    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        saveSettings();
    });
    
    // QRコードエリアをクリックで消去
    document.getElementById('qrcode').addEventListener('click', () => {
        if (currentQRCode) {
            clearQRCode();
            addLog('QRコードをタップして消去しました', 'info');
        }
    });
    
    addLog('初期化完了。使用準備ができました', 'success');
}

// DOMContentLoaded時に初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
