/**
 * デバイス登録ツール
 * コマンドラインからデバイスIDとパスコードを登録する
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data');
const devicesDbPath = path.join(dbPath, 'devices.json');

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
    // データディレクトリが存在しない場合は作成
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
    }
    fs.writeFileSync(devicesDbPath, JSON.stringify(devices, null, 2));
}

/**
 * コマンドライン引数からデバイスを登録
 */
function registerDevice(deviceId, passcode) {
    if (!deviceId || !passcode) {
        console.error('使用方法: node register-device.js <デバイスID> <パスコード>');
        console.error('例: node register-device.js DEVICE001 mypassword123');
        process.exit(1);
    }
    
    const devices = loadDevices();
    
    if (devices[deviceId]) {
        console.log(`⚠️  デバイスID "${deviceId}" は既に登録されています。上書きしますか？`);
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question('上書きする場合は "yes" と入力してください: ', (answer) => {
            if (answer.toLowerCase() === 'yes') {
                devices[deviceId] = {
                    passcode: passcode,
                    registeredAt: new Date().toISOString()
                };
                saveDevices(devices);
                console.log(`✅ デバイス "${deviceId}" を上書き登録しました`);
            } else {
                console.log('キャンセルしました');
            }
            rl.close();
        });
    } else {
        devices[deviceId] = {
            passcode: passcode,
            registeredAt: new Date().toISOString()
        };
        saveDevices(devices);
        console.log(`✅ デバイス "${deviceId}" を登録しました`);
    }
}

/**
 * 登録済みデバイス一覧を表示
 */
function listDevices() {
    const devices = loadDevices();
    const deviceIds = Object.keys(devices);
    
    if (deviceIds.length === 0) {
        console.log('登録されているデバイスはありません');
        return;
    }
    
    console.log('\n登録済みデバイス一覧:');
    console.log('========================');
    deviceIds.forEach(deviceId => {
        const device = devices[deviceId];
        console.log(`\nデバイスID: ${deviceId}`);
        console.log(`パスコード: ${'*'.repeat(device.passcode.length)}`);
        console.log(`登録日時: ${device.registeredAt}`);
    });
    console.log('\n========================\n');
}

// メイン処理
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--list' || args[0] === '-l') {
    // 一覧表示
    listDevices();
} else if (args.length === 2) {
    // デバイス登録
    const [deviceId, passcode] = args;
    registerDevice(deviceId, passcode);
} else {
    console.error('使用方法:');
    console.error('  デバイス登録: node register-device.js <デバイスID> <パスコード>');
    console.error('  一覧表示: node register-device.js --list');
    process.exit(1);
}
