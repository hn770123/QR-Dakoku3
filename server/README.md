# QR出退勤システム - サーバー

出退勤記録を受け付けるバックエンドサーバーです。

## 機能

- JWT トークンの検証
- 初回ユーザー登録
- Cookie によるユーザー管理
- ログファイルへの記録（有効/無効を分離、年月ごと）
- デバイス管理

## セットアップ

### 依存関係のインストール

```bash
npm install
```

### デバイスの登録

サーバーを使用する前に、デバイスを登録する必要があります。

```bash
# 新しいデバイスを登録
node register-device.js <デバイスID> <パスコード>

# 例
node register-device.js DEVICE001 mypassword123

# 登録済みデバイスの確認
node register-device.js --list
```

### サーバーの起動

```bash
# 通常起動
npm start

# 開発モード（ファイル変更時に自動再起動）
npm run dev
```

サーバーは `http://localhost:3000` で起動します。

## API エンドポイント

### GET /record

出退勤記録を受け付けるメインエンドポイント。

**パラメータ:**
- `token` (required): JWT トークン

**レスポンス:**
- 初回アクセス: 登録画面（HTML）
- トークンが有効: 受付完了画面（HTML）
- トークンが無効: エラー画面（HTML）

**例:**
```
http://localhost:3000/record?token=eyJhbGciOiJIUzI1NiJ9...
```

### POST /register

新しいユーザーを登録します。

**リクエストボディ:**
```json
{
  "name": "山田 太郎",
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

**レスポンス:**
```json
{
  "success": true,
  "redirectUrl": "/record?token=..."
}
```

### POST /api/devices

新しいデバイスを登録します（管理用）。

**リクエストボディ:**
```json
{
  "deviceId": "DEVICE001",
  "passcode": "mypassword123"
}
```

**レスポンス:**
```json
{
  "success": true,
  "message": "デバイスを登録しました"
}
```

### GET /api/devices

登録済みデバイスの一覧を取得します（管理用）。

**レスポンス:**
```json
{
  "DEVICE001": {
    "passcode": "mypassword123",
    "registeredAt": "2025-11-17T12:00:00.000Z"
  }
}
```

## ディレクトリ構造

```
server/
├── server.js              # メインサーバー
├── register-device.js     # デバイス登録ツール
├── package.json           # 依存関係
├── data/                  # データベース（自動作成）
│   ├── devices.json       # デバイス情報
│   └── users.json         # ユーザー情報
└── logs/                  # ログファイル（自動作成）
    ├── valid-YYYY-MM.log  # 有効なリクエスト
    └── invalid-YYYY-MM.log # 無効なリクエスト
```

## ログファイル

### 有効なリクエスト（valid-YYYY-MM.log）

```
[2025/11/17 12:00:00] {"deviceId":"DEVICE001","name":"山田 太郎","action":"出勤","timestamp":"2025/11/17 12:00:00"}
```

### 無効なリクエスト（invalid-YYYY-MM.log）

```
[2025/11/17 12:00:00] {"error":"デバイスが登録されていません","token":"eyJhbGci...","timestamp":"2025/11/17 12:00:00"}
```

## 環境変数

以下の環境変数を設定できます（オプション）:

```bash
PORT=3000  # サーバーのポート番号（デフォルト: 3000）
```

## セキュリティ

- JWT トークンは HS256 アルゴリズムで署名
- パスコードはデバイスごとに管理
- トークンの有効期限は3分間
- 無効なリクエストはすべてログに記録

## トラブルシューティング

### デバイスが登録されていないエラー

```bash
# デバイスを登録
node register-device.js DEVICE001 mypassword123

# 登録を確認
node register-device.js --list
```

### ポートが使用中のエラー

```bash
# 別のポートを指定
PORT=3001 npm start
```

### ログファイルが作成されない

- `logs/` ディレクトリが自動的に作成されます
- 書き込み権限を確認してください

## 開発

### テスト

```bash
# 依存関係のインストール
npm install

# デバイスの登録
node register-device.js TEST001 testpass123

# サーバーの起動
npm start

# 別のターミナルでテスト実行
curl "http://localhost:3000/record?token=..."
```

## ライセンス

MIT License
