# e-Gov通知文書ビューア（Web版）設計ドキュメント

日付: 2026-09-17
ステータス: 承認済み

## 目的

e-Govの通知文書送達でダウンロードしたZIP（社会保険関連のXML/DTA/CSV等）を、ブラウザにドラッグ＆ドロップするだけで読みやすいHTMLに変換・表示するWebアプリを作る。

既存のCLIツール（`egovdocs-conv2html` リポジトリの `convert-html.sh` + `dta2html.py`）のWeb版に相当する。

## 制約（最重要）

- **通信ゼロ**: 秘匿情報（個人名・保険料額等）を含むため、ファイル内容がネットワークに出てはならない。外部CDN・フォント・アナリティクス・API呼び出しは一切なし。
- **ブラウザ完結**: 変換処理はすべてブラウザ内のJavaScriptで行う。サーバーサイド処理なし。
- **GitHub Pagesでホスティング**: 静的ファイルのみ。ビルド工程なし（mainブランチをそのまま配信）。

## 技術構成

- ビルドなしの素のHTML/CSS/JavaScript（ESモジュール）
- 外部依存ゼロ。ZIP展開はブラウザ標準の `DecompressionStream('deflate-raw')` を使った自前の最小ZIPリーダーで行う（Chrome 103+ / Safari 16.4+ / Firefox 113+）。サードパーティコードが存在しないため、通信していないことを完全に監査できる
- GitHub Pages: mainブランチのルートから配信

## ディレクトリ構成

```text
egovdocs-viewer/
├── index.html          # 単一ページ（ドロップゾーン＋一覧＋プレビュー）
├── css/
│   └── app.css
├── js/
│   ├── app.js          # UI制御・状態管理
│   ├── intake.js       # ドロップ／ファイル選択の受け入れ・フォルダ走査・ZIP再帰展開
│   ├── zip.js          # 自前ZIPリーダー（DecompressionStream、CP932ファイル名対応）
│   ├── pipeline.js     # ファイル種別判定・変換ディスパッチ・XSL解決
│   ├── convert-xml.js  # XML+XSL → XSLTProcessorで変換
│   ├── convert-dta.js  # DTA → テーブルHTML（dta2html.pyのJS移植）
│   ├── convert-csv.js  # CSV → テーブルHTML
│   ├── html-util.js    # HTMLエスケープ・共通ドキュメント枠
│   └── encoding.js     # 文字コード判定・デコード共通処理
├── tests/              # node --test によるユニットテスト
├── docs/superpowers/specs/  # 設計ドキュメント
├── package.json        # テスト実行用（"type": "module"、配信には無関係）
├── .nojekyll
└── README.md
```

## 入力

以下をドラッグ＆ドロップまたはファイル選択で受け付ける。複数同時ドロップ可。

- e-GovからダウンロードしたZIPファイル
- 展開済みフォルダ（`webkitGetAsEntry` によるディレクトリ走査）
- 個別ファイル（XML+XSLの組など）

## データフロー

1. ドロップされた入力を受け取り、仮想ファイルツリー（パス→バイト列のマップ）に正規化する
   - ZIPは自前リーダーでメモリ上に展開（セントラルディレクトリを解析し、deflate圧縮は `DecompressionStream('deflate-raw')` で伸長）。ZIPの中のZIPも再帰的に展開する
   - **ZIPエントリのファイル名はCP932の可能性が高い**。ZIPのUTF-8フラグ（general purpose bit 11）が立っていない場合は、まずUTF-8厳密デコードを試し、失敗したらCP932とみなす（Windows製e-GovのCP932名と、フラグを立てないmacOS zipのUTF-8名の両方に対応）
2. ファイル種別ごとに変換:
   - **XML**: 先頭の `<?xml-stylesheet type="text/xsl" href="..."?>` からXSLファイル名を抽出し、同じフォルダ内のXSLを `XSLTProcessor` で適用してHTML化。e-GovのXSLはすべてXSLT 1.0なのでブラウザ標準機能で処理可能
   - **DTA**: shift_jisでデコードし、1行目をヘッダー情報、2行目以降のカンマ区切り行（5フィールド以上）をデータ行として、現行Pythonスクリプトと同じ11列（No.＋コード1〜3、郵便番号1〜2、住所、会社名、氏名、電話番号、その他）のテーブルHTMLを生成
   - **CSV**: まずUTF-8厳密デコード（`TextDecoder('utf-8', {fatal: true})`）を試し、失敗したらshift_jisにフォールバック。全行をテーブル表示（1行目はヘッダー行として強調）。セル値に含まれるHTML断片は全体エスケープ後に安全なパターン（`<br/>`、`http(s)`の`<a>`リンク）のみ復元して描画する（DTAセルも同様）
   - **PDF等その他のファイル**: 変換せず、一覧からクリックでBlob URLによりダウンロード／ブラウザ表示
3. 変換結果を画面に表示する

## UI

ファイル一覧＋プレビューの2ペイン構成:

```text
+------------------+--------------------------------+
| 📁 9876...3456   |                                |
|   📄 かがみ       |   日本年金機構からのお知らせ      |
|   📄 社会保険料額  |                                |
|   📊 明細CSV     |   電子送付希望をいただいた…      |
| 📁 9876...3457   |                                |
|   📄 増減内訳書   |   （選択中の文書を表示）         |
+------------------+--------------------------------+
```

- 左サイドバー: フォルダ階層のツリー表示。ファイル種別アイコンと変換ステータス（成功／警告／非対応）を表示
- 右ペイン: 選択したファイルの変換済みHTMLを **`sandbox` 属性付きiframe（`srcdoc`）** に表示
- 初期状態: 全画面ドロップゾーン。ファイル投入後に2ペインへ切り替え。追加ドロップも受け付ける
- 「クリア」ボタンで全データをメモリから破棄して初期状態に戻る

## セキュリティ・秘匿性

- `<meta http-equiv="Content-Security-Policy">` で `default-src 'self'; connect-src 'none'` 相当を宣言し、通信できないことを構造的に保証する
- プレビューiframeは `sandbox` 属性（`allow-scripts` なし）でスクリプト実行を禁止。変換後HTMLは静的なので表示に支障なし。文書内のリンクを新しいタブで開けるよう `allow-popups allow-popups-to-escape-sandbox` のみ許可
- Chrome 153のコンポジタ問題（sandbox付きsrcdoc iframeをhidden→再表示すると再描画されない）回避のため、プレビュー表示のたびにiframe要素を作り直す
- データはメモリ上のみで保持。localStorage / IndexedDB / Cookie への保存はしない
- DTA/CSVのセル値・ファイル名はHTMLエスケープして挿入する（XSS対策。現行Pythonスクリプトは未エスケープなので改善点）
- XSLT変換結果はXSL由来のHTMLなのでそのまま表示するが、iframe sandboxで実行能力を持たない

## エラーハンドリング

- XSL参照が見つからないXML → 一覧に警告表示し、XMLソースを整形（エスケープ＋`<pre>`）表示にフォールバック
- 変換に失敗したファイル → 一覧に残し、選択時に失敗理由を表示
- 壊れたZIP・パスワード付きZIP → エラーメッセージを表示して他の入力の処理は続行
- 未対応拡張子 → ダウンロードリンクとして一覧に表示

## テスト

- 新リポジトリに個人情報風のサンプルデータは含めない
- 動作確認は手元の `egovdocs-conv2html/samples/` をドロップして手動検証:
  - かがみXML（kagami.xsl）の変換表示
  - 様式XML（yoshiki_*.xsl）の変換表示
  - DTAファイルのテーブル表示（CP932）
  - CSVのテーブル表示（UTF-8とCP932の両方）
  - ZIP（CP932ファイル名を含む）の展開
- 変換ロジック（エンコーディング判定、DTA/CSVパース、XSL参照抽出）は純粋関数として切り出し、Node.jsの `node --test` で軽量にユニットテスト可能な構造にする

## スコープ外（YAGNI）

- 変換結果のHTML一括ダウンロード
- 印刷用レイアウト最適化
- PDFのインライン描画
- 過去に開いたファイルの履歴機能
