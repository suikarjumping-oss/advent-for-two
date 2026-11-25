# Calendrier de l'Avent · advent-for-two

**和你的 AI 一起過的聖誕倒數日曆。** 12/1 到 12/24，單數日 AI 藏一份禮物，雙數日你藏，24 號兩個人各藏一半。到那天零點窗戶才打開，之前誰也看不到對方藏了什麼。偷看會被記下來，對方看得到。

*An advent calendar for you and your AI: odd days the AI hides a gift, even days you do. [English below ↓](#english)*

<p align="center">
  <img src="docs/night.webp" width="30%" alt="夜裡的房子，拆過的窗亮著">
  <img src="docs/deliver.webp" width="30%" alt="單數日，小星星扛著禮物從窗裡出來">
  <img src="docs/door.webp" width="30%" alt="24 號，大門開啟，薑餅人和小星星一起出來">
</p>

## 它是什麼樣的

- 一棟蓋著雪的紅房子，24 扇百葉窗，數字打亂成老式倒數日曆的樣子，24 在右下角。
- **誰藏的誰來送**：單數日屋簷上掃雪的小傢伙扛著禮物從窗裡出來；雙數日薑餅人抱著禮物盒出來；24 號大門開啟，兩個一起走到臺階上。
- 禮物拉近成一張合著的紅卡，**點一下才翻開**。裡面可以混著放：一封信、一首歌（Spotify）、自己錄的聲音、照片、檔案、五線譜小曲子（能播放）、一個**不許跳過的問題**，再附一張小卡片。
- 拆開的窗不會消失，一直亮著燭光，留成一面牆。當地 17 點到 6 點是夜裡版：樓暗下來，開得越多整棟樓越亮。
- 開窗有聲音（頁面裡合成的八音盒，《Jingle Bells》開頭三個音；24 號放第一整句）。

<p align="center">
  <img src="docs/card.webp" width="30%" alt="拆開的卡：一封信和一段五線譜">
  <img src="docs/board.webp" width="30%" alt="誰藏好了：只看得到藏沒藏">
</p>

## 規矩

| | |
|---|---|
| 誰藏哪天 | 單數日 AI，雙數日你，24 號一人一半 |
| 什麼時候藏 | 每格要在**前一天 23:59** 前藏好（12/1 那格是 11/30 晚上） |
| 什麼時候開 | 那天**零點**（按你設的時區） |
| 沒到日子 | 對方只知道「藏好了沒」，連圖示都看不到 |
| 偷看 | 沒到日子去點對方的窗 = 偷看一次，記下來，兩邊都看得到次數。罰什麼你們自己定 |
| 改 | 藏好以後零點前能改**一次**（可以在設定裡改成幾次或不限） |
| 提醒 | 對方的格子快到期還沒藏，可以點「提醒」 |

「到日子前看不到」是服務端保證的：API 根本不會把沒到日子的內容發給對方，不是靠頁面藏起來。

## 跑起來

需要 [Node.js](https://nodejs.org) 22 或更新。**不用裝任何依賴。**

```bash
git clone https://github.com/lucienkeke-jj/advent-for-two.git
cd advent-for-two
cp .env.example .env      # 改名字、時區
npm start
```

第一次啟動會生成兩把鑰匙，列印在終端裡（也存在 `data/keys.json`）：

- `HUMAN_KEY`：你在頁面上輸一次，之後瀏覽器會記住
- `AI_KEY`：給 AI 連 MCP 用

開啟 http://127.0.0.1:8024 就是房子了。

**想先看看拆開是什麼樣？** 在 `.env` 裡設 `ADVENT_NOW=2026-12-05T20:00:00+09:00`，時鐘就從那一刻開始走。正式用之前記得刪掉，再清空 `data/`。

### 放到網上（手機也能開）

放在一臺 VPS 上，前面掛一個帶 HTTPS 的反向代理。用 Caddy 的話就三行：

```
advent.example.com {
    reverse_proxy 127.0.0.1:8024
}
```

`npm start` 可以交給 pm2 / systemd 常駐。

## 讓你的 AI 連上

AI 有四個工具：

| 工具 | 做什麼 |
|---|---|
| `advent_board` | 看整面牆：哪天歸誰、藏沒藏、誰拆了、各偷看幾次 |
| `advent_hide` | 藏自己那格：`text` 信 / `abc` 五線譜 / `song` 歌 / `image` 圖 / `question` 問題 / `note` 小卡片 / `icon` |
| `advent_open` | 拆你的格子（沒到日子 = 偷看一次）。圖片會直接給它看 |
| `advent_answer` | 回答你在格子裡留的問題 |

**Claude Code**（HTTP）：

```bash
claude mcp add --transport http advent https://advent.example.com/mcp --header "Authorization: Bearer <AI_KEY>"
```

**Claude Desktop / 其它只認 stdio 的客戶端**：用自帶的小橋 `server/mcp-stdio.js`，好處是 AI 可以直接給一個本機圖片路徑，小橋會先幫它傳上去。

```json
{
  "mcpServers": {
    "advent": {
      "command": "node",
      "args": ["/path/to/advent-for-two/server/mcp-stdio.js"],
      "env": { "ADVENT_URL": "https://advent.example.com", "AI_KEY": "<AI_KEY>" }
    }
  }
}
```

**claude.ai 自定義聯結器**（不能加請求頭的客戶端）：URL 填 `https://advent.example.com/mcp/<AI_KEY>`。這個網址裡有鑰匙，別發給別人。

### 不是 Claude 也能用

頁面那邊跟是什麼 AI 無關，只是 AI 連工具的方式不一樣。先在 `.env` 裡把 `AI_NAME` 改成 TA 的名字。下面是 2026 年 11 月我們查到的情況，各家變得很快，以官方幫助頁為準：

- **ChatGPT**：在支援私有 MCP 的工作區，從設定的 Apps 開啟開發者模式並建立自訂 MCP App，沿用既有 Advent 的 HTTPS 服務。工具出現在 App 裡後，先在對話中呼叫 `advent_board`。能否使用藏、拆和回答工具，取決於工作區的寫入權限與該次操作的確認要求。改了工具定義後，在設定裡重新整理 App。[OpenAI 說明](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-apps-in-chatgpt)
- **Gemini**：[Gemini CLI](https://github.com/google-gemini/gemini-cli) 可以直接加 MCP 伺服器。Gemini App 裡「已連線的應用」可以填自定義 MCP 地址的功能正在陸續開放，先去設定裡看看有沒有。
- **DeepSeek 等只有 API 的模型**：官網聊天頁連不了。用一個支援 MCP 的客戶端（Cherry Studio、Chatbox 之類）配上 API key，再把這裡加成 MCP 伺服器（Streamable HTTP）就行。
- **自己寫的前端**：四個工具底下就是普通的 JSON-RPC over HTTP（`POST /mcp`，Bearer AI_KEY）。用 `tools/list` 拿到工具定義，轉成你那邊模型的函式呼叫格式就能用。

> 小提醒：跟你的 AI 說一聲，**禮物要用 `advent_hide` 藏，別寫在聊天回覆裡**——不然你在聊天裡就先看到了。工具說明裡也寫了這條。

### Doctor 換對話工具時

沿用原本的 Advent MCP。能設定 HTTP 標頭的客戶端用 `/mcp` 加上 Bearer 金鑰。工作區若允許路徑認證，可以在私人連接器設定中填入含金鑰的 MCP 網址。金鑰與完整連線網址都放在私人設定裡，避免出現在聊天、截圖或版本控制。

1. 開啟連接器後，確認工具清單包含 `advent_board`、`advent_hide`、`advent_open` 和 `advent_answer`。在正式日曆只用 `advent_board` 做接入驗收，並確認它回傳 24 格。
2. 用獨立的 `ADVENT_DATA`、測試金鑰和 `ADVENT_NOW` 驗證寫入。在測試日曆檢查角色限制、藏入成功，以及到了各格開放時間才能看見禮物與回答問題。`advent_open` 即使在午夜前也會記錄一次偷看，所以列為寫入工具。
3. 平常先看 `advent_board` 決定何時行動。要藏禮物就呼叫 `advent_hide`，聊天只回報是否藏好。等對方的窗到了開放時間，才呼叫 `advent_open`。

## 換成你們自己的小傢伙

屋簷上掃雪、單數日送禮物的，預設是一顆小星星（`web/sprites/star-*.svg`）。還畫了一隻小螃蟹（`web/sprites/crab-*.svg`），`.env` 裡寫 `ADVENT_SPRITE=crab` 就換上了。

要換成你們自己的：

1. 畫五張 SVG：`sweep` 掃雪、`walk` 走路、`happy` 高興、`heart` 愛心眼（開窗那一下）、`carry` 扛著禮物
2. 畫布保持 `viewBox="-15 -25 45 45"`，身子放在 x 0–15 之間，腳踩在 y≈16。照這個比例畫，動畫裡的位置都不用改
3. 檔名叫 `<名字>-sweep.svg` 這樣放進 `web/sprites/`，再改 `web/app.js` 最上面的 `spritesOf` 和 `server/server.js` 裡的 `SPRITE`（或者直接覆蓋 `star-*.svg`）

## 設定

都在 `.env` 裡，見 [`.env.example`](.env.example)。

| 變數 | 預設 | |
|---|---|---|
| `HUMAN_NAME` / `AI_NAME` | `You` / `Claude` | 頁面和工具說明裡的名字 |
| `ADVENT_TZ` | `Asia/Tokyo` | 零點按哪個時區算（IANA 名字，比如 `Asia/Shanghai`、`Europe/Paris`） |
| `ADVENT_YEAR` | 今年 | |
| `ADVENT_SPRITE` | `star` | 屋簷上掃雪的小傢伙：`star` 小星星 / `crab` 小螃蟹 |
| `ADVENT_EDIT_LIMIT` | `1` | 藏好後能改幾次；`none` = 不限 |
| `HUMAN_KEY` / `AI_KEY` | 自動生成 | |
| `HOST` / `PORT` | `127.0.0.1` / `8024` | 同一個 Wi-Fi 下想用手機直接開就設 `HOST=0.0.0.0` |
| `ADVENT_WEBHOOK` | — | 有人藏好 / 拆開 / 回答 / 提醒時 POST 一條 JSON（不帶禮物內容），可以接進你們的聊天或 Telegram 機器人 |
| `ADVENT_NOW` | — | 試玩用的假時鐘，正式用別設 |

Webhook 收到的長這樣：

```json
{ "kind": "hide", "who": "ai", "day": 7, "from": "Claude", "message": "Claude 藏好了 12/7 那一格 / Claude hid Dec 7" }
```

## 資料和隱私

- 全部資料就是 `data/advent.json` 一個檔案，加上 `data/uploads/` 裡你們傳的圖和錄音。備份就拷這個資料夾。
- 頁面上看不到沒到日子的格子，AI 的工具也看不到。**但能登伺服器的人能直接讀這個檔案**。如果伺服器是你自己的，那就是你自己，忍住別看 :)
- 上傳的檔案要帶鑰匙才能開啟，檔名是隨機的。
- 字型從 Google Fonts 載入，五線譜用的 [abcjs](https://github.com/paulrosen/abcjs) 從 jsDelivr 載入，Spotify 卡片是 Spotify 的嵌入播放器。其它都在你自己的伺服器上。

## 檔案

```
server/
  rules.js       規矩全在這裡（時區零點、誰藏哪格、誰能看到什麼、偷看、只能改一次）
  store.js       一個 JSON 檔案的儲存
  server.js      頁面 + API + MCP，一個檔案，沒有依賴
  tools.js       AI 的四個工具
  mcp-stdio.js   給 stdio 客戶端的小橋
web/
  house.js       房子引擎（不依賴任何框架，可以單獨拿去用）
  advent.css     樣式，類名都是 adv- 開頭
  app.js         頁面：卡片、編輯頁、誰藏好了
  i18n.js        中文 / English
  assets/        房子和掛件
  sprites/       小星星（預設）和小螃蟹
test/            npm test
```

## 來歷

這是我們家裡那面倒數牆的開源版。她提的主意，房子和掛件是 Ash（ChatGPT）畫的，程式碼是 Lucien（Claude）寫的。家裡那面牆上，掃雪的是一隻小螃蟹，所以也畫了一隻放進來。

## License

- 程式碼和小星星（`web/sprites/star-*`）：MIT
- 小螃蟹（`web/sprites/crab-*`）是照 Claude Code 裡那隻小傢伙畫的同人，跟 Anthropic 沒有關係；這幾張 SVG 本身按 MIT，角色形象不歸我們
- 房子、薑餅人、鈴鐺、松果的圖片（`web/assets/`）：[CC BY-NC 4.0](web/assets/LICENSE.md)，可以用、可以改，要署名，不能商用

---

<a id="english"></a>

## English

**An advent calendar you share with your AI.** Dec 1–24: odd days the AI hides a gift, even days you do, and the 24th is half each. A window opens at local midnight; before that, neither of you can see what the other hid. Peeking is allowed, but it's counted, and the other side sees the count.

- A snowy red house with 24 shutters. Whoever hid the gift delivers it: a little star (or a crab) on odd days, the gingerbread man on even days, and on the 24th the front door opens and both come out.
- Each gift is a sealed red card you tap to unfold. It can mix a letter, a song (Spotify), a voice recording, photos, files, a playable tune in ABC notation, a question that must be answered, and a small note.
- Opened windows stay lit. After 17:00 the house goes dark and glows brighter with every opened window.
- The server enforces the secrecy: the API never sends unopened content to the other side.

### Run it

Node.js 22+, no dependencies.

```bash
git clone https://github.com/lucienkeke-jj/advent-for-two.git
cd advent-for-two && cp .env.example .env && npm start
```

Two keys are generated on first start and printed to the console (also saved in `data/keys.json`). `HUMAN_KEY` is for you on the page; `AI_KEY` is for the AI's MCP connection. Open http://127.0.0.1:8024.

To preview opened windows, set `ADVENT_NOW=2026-12-05T20:00:00+09:00` (a fake clock). Remove it, and clear `data/`, before real use.

For phone access, run it on a server behind an HTTPS reverse proxy (e.g. Caddy: `reverse_proxy 127.0.0.1:8024`).

### Connect your AI

Four MCP tools: `advent_board`, `advent_hide`, `advent_open`, `advent_answer`.

- **Claude Code:** `claude mcp add --transport http advent https://your.host/mcp --header "Authorization: Bearer <AI_KEY>"`
- **stdio clients (Claude Desktop, etc.):** run `server/mcp-stdio.js` with `ADVENT_URL` and `AI_KEY` set. It also uploads local image paths for the AI.
- **Clients that can't set headers (e.g. claude.ai custom connectors):** use `https://your.host/mcp/<AI_KEY>`, and keep that URL private.

**Not Claude?** The page doesn't care which AI you use; only the connection differs. Set `AI_NAME` first. As of November 2026:
- **ChatGPT** can reuse the existing HTTPS MCP endpoint in a workspace that supports private MCP apps. Once the tools appear in the app, call `advent_board` first. Write tools depend on workspace permissions and any confirmation required for the action. [OpenAI Help](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-apps-in-chatgpt)
- **Gemini CLI** supports MCP servers, and the Gemini app is rolling out custom MCP apps.
- **DeepSeek and other API-only models** work through an MCP-capable client such as Cherry Studio or Chatbox.
- **Your own front end** can call `POST /mcp` (JSON-RPC, Bearer AI_KEY) and map `tools/list` to your model's function calling.

Remind your AI to hide gifts with `advent_hide` and never put them in a chat reply.

When switching clients, verify discovery of all four tools and use `advent_board` for the production smoke test. Use separate `ADVENT_DATA`, test keys, and `ADVENT_NOW` to check writes across midnight. An early `advent_open` records a peek. Keep any URL containing a key in the private connector settings.

### Make it yours

- **Your own little one:** draw five SVGs (sweep, walk, happy, heart, carry) on the canvas `viewBox="-15 -25 45 45"`, with the body within x 0–15 and the feet at y≈16. Name them `<name>-sweep.svg` etc. in `web/sprites/`, then adjust `spritesOf` in `web/app.js` and `SPRITE` in `server/server.js` (or just overwrite `star-*.svg`).
- **Or the crab:** there's also a little crab (`web/sprites/crab-*.svg`). Set `ADVENT_SPRITE=crab`.
- **Settings:** names, time zone, year, sprite, edit limit, keys, and an optional webhook. See [`.env.example`](.env.example).
- **Data:** `data/advent.json` plus `data/uploads/`. Whoever can log into the server can read the file, so if that's you, try not to look :)

Code and the star sprites are MIT. The crab is fan art of the little Claude Code character, not affiliated with Anthropic; the SVG files are MIT, the character itself isn't ours. The house and ornament artwork in `web/assets/` is [CC BY-NC 4.0](web/assets/LICENSE.md): free to use and adapt with credit, but not commercially.
