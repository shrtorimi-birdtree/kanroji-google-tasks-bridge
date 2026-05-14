# Kanroji Google Tasks Bridge

Google TasksをChatGPT Custom GPT Actionsから安全に操作するための、個人利用MVPです。

このMVPは、営業OSの実行面であるGoogle Tasksを「読む」「明示指示で作成する」「明示指示で期限変更する」「監査用JSONを返す」ことに限定します。

## できること

- 今日・明日の未完了Google Tasksを取得する
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
4. アクセスできるユーザー：自分、または必要に応じてアクセス可能な範囲
5. デプロイURLを取得する
6. `openapi/google-tasks-action.yaml` の `servers.url` をデプロイURLへ差し替える

## Custom GPT Action 設定

1. Custom GPTのActions設定を開く
2. `openapi/google-tasks-action.yaml` を貼り付ける
3. `servers.url` をApps Script Web AppのURLに差し替える
4. 認証はMVPではOpenAPI側ではなく、リクエストbodyの `secret` で行う
5. GPTの指示文側に、必要時のみ `secret` を渡す運用を設定する

## テスト用payload

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
  "error": "unauthorized"
}
```

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
