/**
 * JWT生成と検証のテスト
 */

import * as jose from 'jose';

async function testJWT() {
    console.log('JWT生成と検証のテスト開始...\n');
    
    // テストパラメータ
    const deviceId = 'TEST001';
    const passcode = 'testpassword123';
    const action = 'clockIn';
    const timestamp = Date.now();
    const expirationTime = Math.floor(timestamp / 1000) + (3 * 60); // 3分後
    
    // ペイロード作成
    const payload = {
        deviceId: deviceId,
        action: action,
        timestamp: timestamp,
        exp: expirationTime
    };
    
    console.log('ペイロード:', JSON.stringify(payload, null, 2));
    
    // パスコードから鍵を生成
    const secret = new TextEncoder().encode(passcode);
    
    // JWTを署名
    console.log('\nJWT生成中...');
    const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expirationTime)
        .sign(secret);
    
    console.log('生成されたトークン:', token.substring(0, 50) + '...');
    
    // トークンを検証
    console.log('\nトークン検証中...');
    const { payload: verifiedPayload } = await jose.jwtVerify(token, secret);
    
    console.log('検証成功！');
    console.log('デコードされたペイロード:', JSON.stringify(verifiedPayload, null, 2));
    
    // URL生成
    const serverUrl = 'http://localhost:3000/record';
    const qrUrl = `${serverUrl}?token=${token}`;
    
    console.log('\n生成されるURL:');
    console.log(qrUrl.substring(0, 100) + '...');
    
    console.log('\n✅ すべてのテストが成功しました！');
}

testJWT().catch(error => {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
});
