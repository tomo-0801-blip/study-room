# 自分の勉強部屋

論文・基礎知識・まとめ資料・勉強会資料と小テストをまとめた勉強用アプリです。
スマホのホーム画面に置いて使え、登録したメンバーだけがログインできます。

- 画面：GitHub Pages（無料）
- データとログイン：Supabase（無料枠）
- チャット・AI検索・記述問題のAI採点：Anthropic API（使った分だけ課金。最初はオフで、無料で使えます）

---

## はじめに一度だけやること（30〜40分）

### 1. Supabase でプロジェクトを作る
1. https://supabase.com にGitHubアカウントでサインアップします。
2. 「New project」を押し、名前に `study-room`、Region に `Northeast Asia (Tokyo)` を選びます。データベースのパスワードは自動生成のままで構いません（控えておきます）。
3. 作成が終わるまで1〜2分待ちます。

### 2. データベースを準備する
1. 左メニューの「SQL Editor」を開きます。
2. このフォルダの `supabase/schema.sql` の中身を全部貼り付けて「Run」を押します。
3. 続けて、別にお渡しした `seed.sql` の中身を全部貼り付けて「Run」を押します。今の書庫の中身（論文70本・基礎知識29項目・まとめ資料11件・勉強会資料1件）と、管理者としてのあなたのメールアドレスが入ります。
   ※ `seed.sql` はGitHubには置かないでください。

### 3. ログインの設定
1. 左メニューの「Authentication」→「Sign In / Providers」→「Email」を開きます。
2. 「Confirm email」をオフにして保存します。
   - メールの送信を使わずに、メールアドレスとパスワードでログインする設定です。
   - 名簿（メンバー）に載っていない人は、登録できても中身は一切見られません。

### 4. AI の中継を作る（AI機能を使うときだけ。最初は飛ばして構いません）
1. https://console.anthropic.com でAPIキーを作ります（クレジットの購入が必要です）。
2. Supabase の左メニュー「Edge Functions」→「Deploy a new function」→「Via Editor」を選びます。
3. 関数名を `ai` にし、`supabase/functions/ai/index.ts` の中身を全部貼り付けて「Deploy」を押します。
4. 「Edge Functions」→「Secrets」で、次を追加します。
   - `ANTHROPIC_API_KEY`：手順1で作ったキー
   - （任意）`AI_MODEL`：使うモデル。何も入れなければ `claude-haiku-4-5-20251001`（安くて速い）を使います。
5. GitHub上の `config.js` で `ai: false` を `ai: true` に変えて保存します。

AI機能がオフの間は、チャットとAI検索のボタンが出ず、記述問題は「指定の言葉が入っているか」で判定します。

### 5. GitHub に置いて公開する
1. GitHub で新しいリポジトリ `study-room` を作ります（Public）。
2. 「uploading an existing file」を押し、このフォルダの中身をすべてドラッグして「Commit changes」を押します。
3. Supabase の「Project Settings」→「API」から `Project URL` と `anon public` key をコピーし、GitHub上で `config.js` を開いて鉛筆マークから2か所に貼り付けて保存します。
   - anon key は公開されても問題ない鍵です。
4. リポジトリの「Settings」→「Pages」で、Source を `Deploy from a branch`、Branch を `main` / `(root)` にして保存します。
5. 1〜2分後、`https://（あなたのGitHub名）.github.io/study-room/` で開けるようになります。

### 6. スマホのホーム画面に置く
- iPhone：Safari で上のURLを開く →「共有」→「ホーム画面に追加」
- Android：Chrome で開く → メニュー →「ホーム画面に追加」（「アプリをインストール」と出ることもあります）

初回は「はじめての方はこちら（登録）」から、名簿に入っているメールアドレスとパスワード（8文字以上）を決めてください。

---

## メンバーの追加
管理者としてログインすると、上の「メンバー」ボタンから追加できます。

| できること | 中身 |
|---|---|
| 見る | 閲覧・検索・小テスト・チャット |
| 見る＋追加・編集 | 上に加えて、論文や資料の追加・編集 |
| 管理者 | 上に加えて、メンバーの管理 |

追加された人は、アプリの「はじめての方はこちら（登録）」から自分でパスワードを決めて使い始めます。
パスワードを忘れた人は、Supabase の「Authentication」→「Users」でその人を削除すると、もう一度登録し直せます。

## 料金の目安
- GitHub Pages・Supabase：無料枠で足ります（Supabase の無料プロジェクトは1週間使われないと一時停止し、ダッシュボードから再開できます）。
- Anthropic API：チャット1回あたり数円程度（Haiku 4.5 の場合）。Anthropic のコンソールで月の上限額を決めておくと安心です。

## 中身の更新（アプリの見た目や機能）
GitHub のファイルを差し替えると、次に開いたときに反映されます。
