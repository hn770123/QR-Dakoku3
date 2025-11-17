/**
 * サーバーエンドポイントのテスト
 */

import * as jose from 'jose';

async function testServer() {
    console.log('サーバーエンドポイントのテスト開始...\n');
    
    // テストパラメータ
    const deviceId = 'TEST001';
    const passcode = 'testpassword123';
    const action = 'clockIn';
    const timestamp = Date.now();
    const expirationTime = Math.floor(timestamp / 1000) + (3 * 60);
    
    // ペイロード作成
    const payload = {
        deviceId: deviceId,
        action: action,
        timestamp: timestamp,
        exp: expirationTime
    };
    
    // パスコードから鍵を生成
    const secret = new TextEncoder().encode(passcode);
    
    // JWTを署名
    const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expirationTime)
        .sign(secret);
    
    console.log('生成されたトークン:', token.substring(0, 50) + '...\n');
    
    // サーバーにリクエスト
    const serverUrl = `http://localhost:3000/record?token=${token}`;
    
    console.log('リクエスト送信中...');
    console.log('URL:', serverUrl.substring(0, 80) + '...\n');
    
    try {
        const response = await fetch(serverUrl);
        const html = await response.text();
        
        console.log('レスポンスステータス:', response.status);
        console.log('Content-Type:', response.headers.get('content-type'));
        
        // HTMLから主要な情報を抽出
        if (html.includes('初回登録')) {
            console.log('\n✅ 登録画面が正しく表示されました');
            console.log('（初回アクセスのため、ユーザー登録が必要です）');
        } else if (html.includes('無効なリクエスト')) {
            console.log('\n❌ 無効なリクエストとして処理されました');
            console.log('エラー内容を確認してください');
        } else if (html.includes('受け付けました')) {
            console.log('\n✅ 出退勤記録が正常に受け付けられました');
        }
        
        console.log('\n✅ サーバーテストが完了しました！');
        
    } catch (error) {
        console.error('❌ エラーが発生しました:', error.message);
        process.exit(1);
    }
}

testServer();
