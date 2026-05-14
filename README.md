# Kanroji Google Tasks Bridge

Google TasksをChatGPT Custom GPT Actionsから安全に操作するための、個人利用MVPです。

このMVPは、営業OSの実行面であるGoogle Tasksを「読む」「明示指示で作成する」「明示指示で期限変更する」「監査用JSONを返す」ことに限定します。

## できること

- 今日・明日の未完了Google Tasksを取得する
- Web AppとCustom GPT Actionsの疎通を確認する
- 明示されたタスクだけ新規作成する
- 明示されたタスクだけ期限変更する
- 監査用JSONを返す

## 意図的にやらないこと

- タスクの完了処理
- タスクの削除処理
- 一括削除
- 期限切れタスクの自動移動
- AI判断による自動完了
- 邸名や案件名の推測登録
- 日付なしタスクの作成

## リポジトリ構成

```text
apps-script/Code.gs
apps-script/appsscript.json
openapi/google-tasks-action-v2.yaml
openapi/google-tasks-action.yaml
docs/security-policy.md
README.md
```

## Google Apps Script セットアップ

1. Google Apps Scriptで新規プロジェクトを作成する
2. `apps-script/Code.gs` の内容をApps Scriptの `Code.gs` に貼り付ける
3. `apps-script/appsscript.json` の内容をマニフェストに貼り付ける
4. サービスから **Google Tasks API** を追加する
5. Google Cloud側でもTasks APIが有効になっていることを確認する

## Advanced Google Services / Tasks API v1

Apps Scriptエディタで以下を行います。

1. 左メニューの「サービス」を開く
2. `Google Tasks API` を追加する
3. 識別子が `Tasks` になっていることを確認する
4. バージョンは `v1` を使用する

## Script Property 設定

Apps Scriptのスクリプトプロパティに以下を設定します。

```text
KANROJI_TASKS_SECRET=任意の長いランダム文字列
```

必要に応じて、対象タスクリストを変える場合のみ以下を設定できます。

```text
KANROJI_TASKLIST_ID=@default
```

未設定の場合は `@default` を使用します。

## Web App デプロイ

1. Apps Script右上の「デプロイ」から「新しいデプロイ」を選択
2. 種類は「ウェブアプリ」
3. 次のユーザーとして実行：自分
4. アクセスできるユーザー：**全員（匿名ユーザーを含む）**
5. 認可を完了し、末尾が `/exec` のウェブアプリURLを取得する
6. `openapi/google-tasks-action-v2.yaml` の `servers.url` を、デプロイURLから末尾の `/exec` を外したURLへ差し替える
7. `Code.gs` を変更した後は「デプロイを管理」から同じデプロイを編集し、バージョンを「新バージョン」にして再デプロイする

Custom GPT Actionsから直接呼ぶ場合、OpenAI側はあなたのGoogleアカウントとしてログインできません。そのため「アクセスできるユーザー」が「自分」や組織内だけだと、ブラウザでは見えてもActionからは失敗します。

URLはApps ScriptエディタのブラウザURLではなく、デプロイ画面に表示されるウェブアプリURLを使います。`/u/0/`、`/u/1/`、`/edit`、`/dev` を含むURLはCustom GPT Actions用に使わないでください。

OpenAPIでは `paths` 側に `/exec` を定義しています。そのため、ウェブアプリURLが `https://script.google.com/macros/s/DEPLOYMENT_ID/exec` の場合、`servers.url` には `https://script.google.com/macros/s/DEPLOYMENT_ID` を設定します。

## Custom GPT Action 設定

1. Custom GPTのActions設定を開く
2. `openapi/google-tasks-action-v2.yaml` を貼り付ける
3. `servers.url` をApps Script Web AppのURLから末尾の `/exec` を外したURLに差し替える
4. 認証はMVPではOpenAPI側ではなく、リクエストbodyの `secret` で行う
5. GPTの指示文側に、必要時のみ `secret` を渡す運用を設定する

## テスト用payload

### health_check

Google Tasks APIを呼ばずに、Web Appとsecretの疎通だけを確認します。

```json
{
  "secret": "YOUR_SECRET",
  "action": "health_check"
}
```

### list_today_tomorrow

```json
{
  "secret": "YOUR_SECRET",
  "action": "list_today_tomorrow"
}
```

### create_task

```json
{
  "secret": "YOUR_SECRET",
  "action": "create_task",
  "title": "山田邸｜業者見積依頼",
  "due": "2026-05-14",
  "notes": "内装見積。資料確認後に依頼。"
}
```

### update_due

```json
{
  "secret": "YOUR_SECRET",
  "action": "update_due",
  "taskId": "TASK_ID",
  "due": "2026-05-15"
}
```

### audit_snapshot

```json
{
  "secret": "YOUR_SECRET",
  "action": "audit_snapshot"
}
```

## レスポンス形式

すべてJSONで返します。

成功例：

```json
{
  "ok": true,
  "timezone": "Asia/Tokyo",
  "tasks": []
}
```

失敗例：

```json
{
  "ok": false,
  "error": "unauthorized",
  "reason": "invalid_secret"
}
```

## 接続トラブルシュート

現在のWeb App URLを直接開いてGoogle Drive風の「現在、ファイルを開くことができません。アドレスを確認してからもう一度お試しください。」という画面になる場合、`doGet()` まで到達していない可能性が高いです。コード内のGoogle Tasks API処理ではなく、Web AppのデプロイURL、公開範囲、またはデプロイ版の問題として切り分けます。

### 1. GETでWeb Appに到達できるか確認

シークレットウィンドウまたはログアウト状態のブラウザで、デプロイURLをそのまま開きます。URLは必ず `/exec` で終わるものを使い、末尾の `/` や `/health` は付けません。

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

期待結果はJSONです。

```json
{
  "ok": true,
  "service": "kanroji-google-tasks-bridge",
  "status": "ready"
}
```

JSONではなくGoogleのエラーページが出る場合は、以下を確認します。

- デプロイ種別が「ウェブアプリ」になっている
- 「次のユーザーとして実行」が「自分」になっている
- 「アクセスできるユーザー」が「全員（匿名ユーザーを含む）」になっている
- Apps ScriptエディタやGoogle DriveのURLではなく、デプロイ画面のウェブアプリURLを使っている
- URLが `/exec` で終わっており、末尾に `/` や `/health` を付けていない
- URLに `/u/0/`、`/u/1/`、`/edit`、`/dev` を含んでいない
- `Code.gs` 変更後に、新しいバージョンとして再デプロイしている

### 2. POSTのhealth_checkを確認

GETがJSONを返すようになったら、ターミナルでPOST疎通を確認します。

```bash
curl -L "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{"secret":"YOUR_SECRET","action":"health_check"}'
```

`ok: true` が返れば、Custom GPT Actionsから呼ぶためのWeb App URLとsecretの基本疎通はできています。`unauthorized` の場合、`reason` が `server_secret_not_configured` ならScript Property未設定、`invalid_secret` ならGPT側またはcurl側のsecret違いです。

Apps Script Web Appは、`/exec/` や `/exec/health` のような追加パスでGoogleのエラーページを返す場合があります。Custom GPT Actions側では、OpenAPIの `servers.url` に `/exec` を含めず、`paths` の `/exec` と組み合わせて呼び出します。

### 3. HTTP 302とCustom GPT Actionの切り分け

Apps Scriptの `ContentService` は、JSONを返すときに `script.google.com` から `script.googleusercontent.com` の一時URLへHTTP 302リダイレクトします。これはApps Scriptの仕様です。

`curl -L` のようにリダイレクトを追えるHTTPクライアントでは成功しても、Custom GPT Actions側で結果を受け取れず「思考中」のまま止まる場合があります。その場合は、Apps Scriptの処理やsecretではなく、GPT ActionsがApps Scriptのリダイレクト応答を処理できていない可能性を疑います。

リダイレクト有無の確認例：

```bash
curl -i "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{"secret":"YOUR_SECRET","action":"health_check"}'
```

`HTTP 302` と `Moved Temporarily` が返り、`curl -L` では `{"ok":true,...}` が返るなら、Web App自体は動作しています。

`HtmlService` に切り替えるとHTTP 200にはできますが、Apps ScriptのHTMLラッパーが返り、純粋なJSON APIレスポンスではなくなります。このBridgeでは採用しません。Custom GPT Actionsでリダイレクトが原因と見られる停止が続く場合は、Cloudflare WorkersなどのAPIゲートウェイを前段に置き、ゲートウェイ側でApps Scriptのリダイレクトを追ってJSONだけを返す構成にしてください。

### 4. Google Tasks APIの到達を確認

`health_check` は成功するのに `list_today_tomorrow` が失敗する場合は、Web App自体ではなくGoogle Tasks APIまわりを確認します。

- Apps Scriptの「サービス」に `Google Tasks API` が追加され、識別子が `Tasks` になっている
- Google Cloud側でTasks APIが有効になっている
- 初回実行時の承認が完了している
- `KANROJI_TASKLIST_ID` を設定している場合、そのタスクリストIDが正しい

### 5. Custom GPT ActionがApps Scriptに届いているか確認

Custom GPTからActionを実行した直後に、Apps Scriptエディタ左側の「実行数」を開きます。`doPost` の実行履歴が出ていれば、ActionはApps Scriptまで届いています。履歴が出ない場合は、OpenAPIの `servers.url`、Web App公開範囲、またはURLの種類が原因です。

## Google Tasksのdue日付仕様

Google Tasks APIの `due` はRFC3339形式ですが、Google Tasks側では日付情報のみが保持され、時刻部分は破棄されます。

このMVPでは、入力は `YYYY-MM-DD` を基本とし、Apps Script側で `YYYY-MM-DDT00:00:00.000Z` に変換します。日付境界の判定は `Utilities.formatDate` と `Asia/Tokyo` を使い、JST基準で処理します。

## 日付なしタスク候補について

`audit_snapshot` は、未完了タスクのうち `due` が空のものを日付なし候補として返します。

ただし、Google Tasks APIの一覧取得条件や件数上限により、全タスクを完全に網羅できない可能性があります。このMVPではページネーションに対応し、取得できる範囲で最大限検出します。

## セキュリティ方針

This is a personal-use MVP. For shared GPTs, team use, or company deployment, place an API gateway such as Cloudflare Workers between ChatGPT Actions and Apps Script, and validate credentials outside Apps Script.

このMVPはApps Script `doPost(e)` でHTTPヘッダーを直接読めない前提で、body内の `secret` を検証します。個人利用の初期検証には十分ですが、共有GPTや社内展開には弱い構成です。

詳細は `docs/security-policy.md` を参照してください。

## 将来フェーズ案

MVP後に検討する機能です。初期実装には含めません。

- Cloudflare Workers等のAPIゲートウェイ追加
- タスク完了処理。ただし明示指示と確認付きのみ
- Google Calendarとの監査連携
- Notion案件ページとの照合
- 操作ログ保存
- タスク作成前の二重登録チェック強化
