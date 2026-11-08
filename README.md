# Open WebUI 網頁助手 — Edge / Chrome Extension

在瀏覽器側邊欄選模型、對談、整理目前網頁與查找公開來源的獨立擴充功能。

**不需要安裝桌面 App、Python Agent 或 Mac Edge Bridge。** 可以直接連 Ollama，也可以連到其他電腦、NAS、Docker 或雲端的 Open WebUI。

## 功能

- Ollama 模型選單、串流回答、停止生成與歷史對談。
- 每次送出自動閱讀當下選取的網頁，顯示已讀頁面標題；不需要勾選分享頁面的 checkbox。
- 繁體中文介面與回答指示，側欄正文 14px。
- 網頁專用開場：整理目前網頁、檢查重點與疑點、比較規格與選擇。
- 支援工具呼叫的模型可提出 Google 搜尋、公開來源閱讀、捲動、點擊、填字與同網站導覽。
- 點擊、填字、導覽、搜尋與額外來源閱讀先顯示目標，等待使用者當次核准。
- 顯示 tokens/s 與從送出到回答完成的耗時。

## 安裝

安裝擴充功能不需要 Node.js、Python 或建置步驟。

1. 下載本儲存庫：右上角 **Code → Download ZIP**，解壓縮。
2. 開啟 Edge 的 `edge://extensions` 或 Chrome 的 `chrome://extensions`。
3. 開啟「開發人員模式」，按「載入解壓縮」。
4. 選取本專案的 **`extension/` 資料夾**，內含 `manifest.json`。
5. 在瀏覽器的擴充功能選單，開啟 **Open WebUI Edge Bridge**，右上角齒輪進入設定。

需要 Chromium 120 以上的瀏覽器。已實測 Microsoft Edge；Chrome 使用相同的 Manifest V3 / Side Panel API，尚未另行完成 Chrome 的人工驗收。這是獨立客戶端專案，非 Open WebUI 官方擴充功能。

## 設定模型來源

### 直接連 Ollama：獨立使用

選「直接連 Ollama」，填入來源，例如 `http://127.0.0.1:11434` 或 `192.168.1.10:11434`，按「測試來源連線」，再按「儲存並載入模型」。需要該 Ollama API 可從你的瀏覽器所在電腦連線。對談與來源設定保留在擴充功能。

### Open WebUI：同步來源與對談

選「Open WebUI（同步來源與對談）」，填入伺服器網址並登入原本帳號。管理員可讀取伺服器既有的 Ollama 連線，選擇要修改的來源、測試 IP／網址，再儲存。

**在此模式修改 Ollama 來源，會同步套用到該 Open WebUI 的網頁與手機 App。** 其他 Ollama 連線及每來源設定保留；來源若已被其他地方變更，會拒絕直接覆蓋並要求重新讀取。首次設定流程目前需要可讀取來源設定的管理員帳號。

完成的對談會同步儲存到同一台 Open WebUI，可從歷史入口繼續既有對談。偵測到其他客戶端修改同一則對談時，另存接續對談，保留既有分支、附件與參數。

兩種模式目前都使用 **Ollama 模型**。Open WebUI 模式使用官方 Ollama proxy，擴充功能自行處理網頁脈絡與工具；不包含網頁版的自訂 Filter、Skill、Deep Research 或 OpenAI provider 介面。

## 資料與權限

每次送出的目前頁面文字會傳給你選定的模型來源。登入密碼不保存，登入 token 只保留在 `chrome.storage.session`；重新載入、停用擴充功能或結束瀏覽器工作階段後需重新登入。Token 不轉送至直接 Ollama 或不同的 Open WebUI 位址。

詳見 [PRIVACY.md](PRIVACY.md)。本儲存庫與打包程式不包含帳密、聊天資料、Mac 設定、Bridge 憑證或本機路徑。

## 開發與測試

執行測試需要 Node.js 20 以上，不需安裝 npm 套件：

```sh
npm test
```

測試涵蓋 MiniCPM 嚴格訊息格式、首次提問／追問／空白失敗後重試、串流錯誤、來源設定衝突、保留其他來源、token 來源隔離、歷史分支保留，以及頁面操作與發佈檔案邊界。測試只使用合成資料，不連線私人服務。

建立可分享的擴充功能 ZIP（僅打包時需 Python 3）：

```sh
python3 scripts/package.py
# Windows 可使用：py scripts/package.py
```

輸出位於 `dist/openwebui-webpage-assistant-3.0.1.zip`。ZIP 採固定允許清單打包；解壓縮後直接載入內含 `manifest.json` 的資料夾。

### 已完成的實測

3.0.1 已在 Edge 使用 MiniCPM-V 4.7 35B Q6 完成實際網頁整理、追問及對談同步。修正前的雙 system 訊息 Jinja 錯誤已重現，修正後首次提問、追問與失敗後重試皆可正常串流。這項功能驗證不代表文章內容已經過獨立事實查核，也不是跨硬體效能保證。

## 專案內容

```text
extension/     可直接載入的擴充功能
test/          無外部相依套件的測試
scripts/       僅供開發者使用的打包程式
PRIVACY.md     資料與權限說明
CHANGELOG.md   版本紀錄
```

## 授權

[MIT License](LICENSE)
