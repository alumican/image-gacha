# Image Gacha Server

画像生成結果を保存するサーバーサイドAPI

## セットアップ

```bash
npm install
```

## 環境変数

`.env` ファイルを作成：

```
PORT=3001
```

## 開発サーバーの起動

```bash
npm run dev
```

## ビルド

```bash
npm run build
npm start
```

## API エンドポイント

### POST /api/upload

画像とメタデータJSONをアップロード

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `image`: 画像ファイル
  - `metadata`: JSONファイル

**Response:**
```json
{
  "success": true,
  "message": "Files uploaded successfully",
  "files": {
    "image": "filename.png",
    "metadata": "filename.json"
  }
}
```

### GET /api/files

アップロードされたファイルの一覧を取得

**Response:**
```json
{
  "files": [
    {
      "image": "filename.png",
      "metadata": "filename.json",
      "metadataContent": { ... }
    }
  ]
}
```

### GET /uploads/:filename

アップロードされたファイルを取得

