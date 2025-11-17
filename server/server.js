/**
 * QR出退勤記録システム サーバー
 * トークンを検証し、出退勤情報をログファイルに記録する
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import * as jose from 'jose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// レート制限の設定（簡易実装）
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分
const RATE_LIMIT_MAX_REQUESTS = 10; // 1分あたり10リクエスト

/**
 * シンプルなレート制限ミドルウェア
 */
function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, []);
    }
    
    const requests = rateLimitMap.get(ip);
    // 古いリクエストを削除
    const recentRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    
    if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).send('Too many requests. Please try again later.');
    }
    
    recentRequests.push(now);
    rateLimitMap.set(ip, recentRequests);
    next();
}

// ミドルウェアの設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ログディレクトリの作成
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// データベース（簡易的にJSONファイルで管理）
const dbPath = path.join(__dirname, 'data');
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
}

const usersDbPath = path.join(dbPath, 'users.json');
const devicesDbPath = path.join(dbPath, 'devices.json');

/**
 * ユーザーデータベースの読み込み
 * @returns {Object} ユーザー情報のオブジェクト
 */
function loadUsers() {
    if (fs.existsSync(usersDbPath)) {
        const data = fs.readFileSync(usersDbPath, 'utf8');
        return JSON.parse(data);
    }
    return {};
}

/**
 * ユーザーデータベースの保存
 * @param {Object} users - ユーザー情報のオブジェクト
 */
function saveUsers(users) {
    fs.writeFileSync(usersDbPath, JSON.stringify(users, null, 2));
}

/**
 * デバイスデータベースの読み込み
 * @returns {Object} デバイス情報のオブジェクト
 */
function loadDevices() {
    if (fs.existsSync(devicesDbPath)) {
        const data = fs.readFileSync(devicesDbPath, 'utf8');
        return JSON.parse(data);
    }
    return {};
}

/**
 * デバイスデータベースの保存
 * @param {Object} devices - デバイス情報のオブジェクト
 */
function saveDevices(devices) {
    fs.writeFileSync(devicesDbPath, JSON.stringify(devices, null, 2));
}

/**
 * ログファイルに記録する
 * @param {string} type - ログタイプ ('valid' or 'invalid')
 * @param {Object} data - 記録するデータ
 */
function writeLog(type, data) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const logFileName = `${type}-${yearMonth}.log`;
    const logFilePath = path.join(logsDir, logFileName);
    
    const timestamp = now.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const logEntry = `[${timestamp}] ${JSON.stringify(data)}\n`;
    fs.appendFileSync(logFilePath, logEntry);
}

/**
 * トークンを検証する
 * @param {string} token - JWT トークン
 * @param {string} passcode - パスコード（秘密鍵）
 * @returns {Promise<Object>} デコードされたペイロード
 */
async function verifyToken(token, passcode) {
    const secret = new TextEncoder().encode(passcode);
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
}

/**
 * メインページ - 出退勤記録を受け付ける
 * レート制限を適用
 */
app.get('/record', rateLimit, async (req, res) => {
    const token = req.query.token;
    const userId = req.cookies.userId;
    
    // トークンがない場合
    if (!token) {
        return res.send(generateHtml('エラー', `
            <div class="error">
                <h2>❌ 無効なリクエストです</h2>
                <p>トークンが見つかりません。設定を確認してください。</p>
            </div>
        `));
    }
    
    try {
        // ユーザー登録チェック
        const users = loadUsers();
        
        if (!userId || !users[userId]) {
            // 初回アクセス - 登録画面を表示
            return res.send(generateRegistrationHtml(token));
        }
        
        const userName = users[userId].name;
        
        // デバイス情報を取得
        const devices = loadDevices();
        
        // トークンをデコード（検証なしで取得）
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('トークンの形式が無効です');
        }
        
        const payloadBase64 = parts[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        
        const deviceId = payload.deviceId;
        
        // デバイスが登録されているか確認
        if (!devices[deviceId]) {
            throw new Error('デバイスが登録されていません');
        }
        
        const passcode = devices[deviceId].passcode;
        
        // トークンを検証
        const verifiedPayload = await verifyToken(token, passcode);
        
        // タイムスタンプをフォーマット
        const timestamp = new Date(verifiedPayload.timestamp);
        const formattedTime = timestamp.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // 動作タイプを日本語に変換
        const actionText = verifiedPayload.action === 'clockIn' ? '出勤' : '退勤';
        
        // 有効なログを記録
        writeLog('valid', {
            deviceId: deviceId,
            name: userName,
            action: actionText,
            timestamp: formattedTime
        });
        
        // 成功レスポンス
        return res.send(generateHtml('記録完了', `
            <div class="success">
                <h2>✅ ${userName}さん、${actionText}を受け付けました</h2>
                <p class="timestamp">${formattedTime}</p>
                <div class="details">
                    <p><strong>デバイスID:</strong> ${deviceId}</p>
                    <p><strong>動作:</strong> ${actionText}</p>
                </div>
            </div>
        `));
        
    } catch (error) {
        // 無効なトークン
        writeLog('invalid', {
            error: error.message,
            token: token.substring(0, 50) + '...',
            timestamp: new Date().toLocaleString('ja-JP')
        });
        
        return res.send(generateHtml('エラー', `
            <div class="error">
                <h2>❌ 無効なリクエストです</h2>
                <p>設定を確認してください。</p>
                <p class="error-detail">${error.message}</p>
            </div>
        `));
    }
});

/**
 * ユーザー登録API
 */
app.post('/register', (req, res) => {
    const { name, token } = req.body;
    
    if (!name || !token) {
        return res.json({ success: false, message: '名前とトークンが必要です' });
    }
    
    // ユーザーIDを生成
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // ユーザーを保存
    const users = loadUsers();
    users[userId] = {
        name: name,
        registeredAt: new Date().toISOString()
    };
    saveUsers(users);
    
    // Cookieを設定（セキュアフラグ付き）
    res.cookie('userId', userId, { 
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1年間有効
        httpOnly: true, // JavaScriptからアクセス不可
        secure: process.env.NODE_ENV === 'production', // 本番環境ではHTTPSのみ
        sameSite: 'lax' // CSRF対策
    });
    
    // トークン付きでリダイレクト
    res.json({ success: true, redirectUrl: `/record?token=${token}` });
});

/**
 * デバイス登録API（管理用）
 */
app.post('/api/devices', (req, res) => {
    const { deviceId, passcode } = req.body;
    
    if (!deviceId || !passcode) {
        return res.status(400).json({ error: 'デバイスIDとパスコードが必要です' });
    }
    
    const devices = loadDevices();
    devices[deviceId] = {
        passcode: passcode,
        registeredAt: new Date().toISOString()
    };
    saveDevices(devices);
    
    res.json({ success: true, message: 'デバイスを登録しました' });
});

/**
 * デバイス一覧取得API（管理用）
 */
app.get('/api/devices', (req, res) => {
    const devices = loadDevices();
    res.json(devices);
});

/**
 * HTMLテンプレート生成
 * @param {string} title - ページタイトル
 * @param {string} content - コンテンツHTML
 * @returns {string} 完全なHTML
 */
function generateHtml(title, content) {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - QR出退勤システム</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            max-width: 500px;
            width: 100%;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
            text-align: center;
        }
        .success {
            color: #155724;
        }
        .success h2 {
            font-size: 24px;
            margin-bottom: 20px;
        }
        .error {
            color: #721c24;
        }
        .error h2 {
            font-size: 24px;
            margin-bottom: 20px;
        }
        .timestamp {
            font-size: 20px;
            font-weight: bold;
            margin: 20px 0;
            color: #495057;
        }
        .details {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            text-align: left;
        }
        .details p {
            margin: 10px 0;
            color: #495057;
        }
        .error-detail {
            margin-top: 15px;
            font-size: 14px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="container">
        ${content}
    </div>
</body>
</html>
    `;
}

/**
 * 登録画面のHTML生成
 * @param {string} token - トークン
 * @returns {string} 完全なHTML
 */
function generateRegistrationHtml(token) {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ユーザー登録 - QR出退勤システム</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            max-width: 500px;
            width: 100%;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
        }
        h1 {
            font-size: 24px;
            margin-bottom: 10px;
            color: #333;
            text-align: center;
        }
        p {
            text-align: center;
            color: #666;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: #495057;
        }
        input[type="text"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #dee2e6;
            border-radius: 8px;
            font-size: 16px;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        button {
            width: 100%;
            padding: 15px;
            font-size: 16px;
            font-weight: bold;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        button:active {
            transform: scale(0.95);
        }
        .message {
            margin-top: 15px;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
            display: none;
        }
        .message.error {
            background: #f8d7da;
            color: #721c24;
        }
        .message.success {
            background: #d4edda;
            color: #155724;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>👤 初回登録</h1>
        <p>お名前を入力して登録してください</p>
        <form id="registrationForm">
            <div class="form-group">
                <label for="name">お名前</label>
                <input type="text" id="name" name="name" placeholder="山田 太郎" required>
            </div>
            <button type="submit">登録する</button>
            <div id="message" class="message"></div>
        </form>
    </div>
    
    <script>
        document.getElementById('registrationForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('name').value.trim();
            const message = document.getElementById('message');
            
            if (!name) {
                message.textContent = '名前を入力してください';
                message.className = 'message error';
                message.style.display = 'block';
                return;
            }
            
            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: name,
                        token: '${token}'
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    message.textContent = '登録完了！リダイレクトしています...';
                    message.className = 'message success';
                    message.style.display = 'block';
                    
                    setTimeout(() => {
                        window.location.href = data.redirectUrl;
                    }, 1000);
                } else {
                    message.textContent = data.message || '登録に失敗しました';
                    message.className = 'message error';
                    message.style.display = 'block';
                }
            } catch (error) {
                message.textContent = 'エラーが発生しました: ' + error.message;
                message.className = 'message error';
                message.style.display = 'block';
            }
        });
    </script>
</body>
</html>
    `;
}

// サーバー起動
app.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
    console.log(`記録用URL: http://localhost:${PORT}/record`);
});
