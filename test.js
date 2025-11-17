/**
 * QRコード検証ツールのスクリプト
 * トークンをデコードして妥当性を検証する
 */

import * as jose from 'https://cdn.jsdelivr.net/npm/jose@5.2.0/+esm';

/**
 * URLパラメータからトークンを取得する
 * @returns {string|null} トークン文字列
 */
function getTokenFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('token');
}

/**
 * LocalStorageからパスコードを読み込む
 * @returns {string} パスコード
 */
function loadPasscode() {
    const passcode = localStorage.getItem('testPasscode') || '';
    document.getElementById('testPasscode').value = passcode;
    return passcode;
}

/**
 * LocalStorageにパスコードを保存する
 */
function savePasscode() {
    const passcode = document.getElementById('testPasscode').value;
    
    if (!passcode) {
        alert('パスコードを入力してください');
        return;
    }
    
    localStorage.setItem('testPasscode', passcode);
    alert('パスコードを保存しました');
    
    // トークンがあれば再検証
    const token = getTokenFromUrl();
    if (token) {
        verifyToken(token, passcode);
    }
}

/**
 * トークンを検証してデコードする
 * @param {string} token - JWT トークン
 * @param {string} passcode - パスコード（秘密鍵）
 */
async function verifyToken(token, passcode) {
    const resultArea = document.getElementById('validationResult');
    
    if (!passcode) {
        resultArea.innerHTML = `
            <div class="status invalid">
                ❌ パスコードが設定されていません
            </div>
            <p style="text-align: center; color: #666;">
                先にパスコードを設定してください
            </p>
        `;
        return;
    }
    
    try {
        // パスコードから鍵を生成
        const secret = new TextEncoder().encode(passcode);
        
        // トークンを検証してデコード
        const { payload, protectedHeader } = await jose.jwtVerify(token, secret);
        
        // 現在時刻と比較して有効期限をチェック
        const now = Math.floor(Date.now() / 1000);
        const isExpired = payload.exp < now;
        
        // タイムスタンプをフォーマット
        const timestamp = new Date(payload.timestamp);
        const formattedTime = timestamp.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // 有効期限をフォーマット
        const expTime = new Date(payload.exp * 1000);
        const formattedExpTime = expTime.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // 動作タイプを日本語に変換
        const actionText = payload.action === 'clockIn' ? '出勤' : '退勤';
        
        // 残り時間を計算
        const remainingSeconds = payload.exp - now;
        const remainingMinutes = Math.floor(remainingSeconds / 60);
        const remainingSecondsDisplay = remainingSeconds % 60;
        
        // 結果を表示
        let statusHtml;
        if (isExpired) {
            statusHtml = `
                <div class="status expired">
                    ⚠️ トークンは有効期限切れです
                </div>
            `;
        } else {
            statusHtml = `
                <div class="status valid">
                    ✅ トークンは有効です（残り ${remainingMinutes}分${remainingSecondsDisplay}秒）
                </div>
            `;
        }
        
        resultArea.innerHTML = `
            ${statusHtml}
            <div class="result-item">
                <div class="result-label">📱 デバイスID</div>
                <div class="result-value">${payload.deviceId}</div>
            </div>
            <div class="result-item">
                <div class="result-label">🚪 動作タイプ</div>
                <div class="result-value">${actionText} (${payload.action})</div>
            </div>
            <div class="result-item">
                <div class="result-label">🕐 タイムスタンプ</div>
                <div class="result-value">${formattedTime}</div>
            </div>
            <div class="result-item">
                <div class="result-label">⏰ 有効期限</div>
                <div class="result-value">${formattedExpTime}</div>
            </div>
            <div class="result-item">
                <div class="result-label">🔐 署名アルゴリズム</div>
                <div class="result-value">${protectedHeader.alg}</div>
            </div>
            <div class="result-item">
                <div class="result-label">📝 トークン（デバッグ用）</div>
                <div class="result-value" style="font-size: 12px; font-family: monospace;">${token.substring(0, 50)}...</div>
            </div>
        `;
        
    } catch (error) {
        // 検証失敗
        resultArea.innerHTML = `
            <div class="status invalid">
                ❌ トークンの検証に失敗しました
            </div>
            <div class="result-item">
                <div class="result-label">エラー詳細</div>
                <div class="result-value">${error.message}</div>
            </div>
            <p style="margin-top: 15px; color: #666;">
                パスコードが間違っているか、トークンが不正です
            </p>
        `;
    }
}

/**
 * 初期化処理
 */
function init() {
    console.log('テストページを初期化中...');
    
    // パスコードの読み込み
    const passcode = loadPasscode();
    
    // URLパラメータの表示
    const token = getTokenFromUrl();
    if (token) {
        document.getElementById('urlInfo').style.display = 'block';
        document.getElementById('urlParam').textContent = `?token=${token.substring(0, 30)}...`;
        
        // トークンを検証
        if (passcode) {
            verifyToken(token, passcode);
        } else {
            document.getElementById('validationResult').innerHTML = `
                <div class="status invalid">
                    ⚠️ パスコードが設定されていません
                </div>
                <p style="text-align: center; color: #666;">
                    先にパスコードを設定してください
                </p>
            `;
        }
    }
    
    // イベントリスナーの設定
    document.getElementById('savePasscodeBtn').addEventListener('click', savePasscode);
    
    console.log('初期化完了');
}

// DOMContentLoaded時に初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
