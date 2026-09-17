# e-Gov通知文書ビューア

e-Govの通知文書送達でダウンロードしたZIPファイルを、ブラウザにドラッグ＆ドロップするだけで読みやすいHTMLに変換・表示するWebアプリです。

## 特徴

- **通信ゼロ**: すべての処理はブラウザ内のJavaScriptで完結します。ファイルの内容が外部に送信されることはありません（Content-Security-Policyで通信を構造的に禁止しています）
- **外部依存ゼロ**: サードパーティライブラリを使用していません。ZIP展開もブラウザ標準APIで行います
- **インストール不要**: GitHub Pagesにアクセスするだけで使えます

## 使い方

1. 公開ページを開く
2. e-GovからダウンロードしたZIPファイル（または展開済みフォルダ・個別ファイル）をドラッグ＆ドロップ
3. 左の一覧からファイルを選ぶと右側に変換結果が表示される

## 対応ファイル

| 種類 | 処理 |
| --- | --- |
| XML（XSL参照あり） | 同梱XSLをXSLT 1.0で適用して表示 |
| XML（XSL参照なし） | ソースを整形表示 |
| DTA | CP932でデコードしてテーブル表示 |
| CSV | UTF-8/CP932を自動判定してテーブル表示 |
| その他（PDF等） | ダウンロードリンク |

## 対応ブラウザ

Chrome 103+ / Edge 103+ / Safari 16.4+ / Firefox 113+（DecompressionStream対応が必要）

## 開発

ビルド工程はありません。ローカル確認は任意の静的サーバーで:

```bash
python3 -m http.server 8765
```

テスト（Node 21以上）:

```bash
npm test
```

## 関連

CLI版: [egovdocs-conv2html](https://github.com/thwoo-inc/egovdocs-conv2html)
