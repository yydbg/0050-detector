# 0050 均線支撐偵測 · Codex

手機與桌面皆可使用的靜態網頁，為 MA5、8、10、13、20、21、34、60 檢查收盤候選訊號，並提供隔日開盤價的部位試算。

**這是條件偵測工具，不會下單，也沒有追蹤你的持倉或實際帳戶回撤。** 不需要券商帳密、API key、付費資料服務或伺服器。

## 先在電腦開啟

直接用瀏覽器開啟 `site/index.html`。套件已含收盤資料，無須安裝套件。金額與價格輸入只留在瀏覽器記憶體，不傳送、不保存。

手機不能透過電腦的 `C:\...` 路徑瀏覽。完成下方部署後，手機開啟GitHub Pages的HTTPS網址即可；也可以用瀏覽器「加入主畫面」。本工具沒有離線快取／service worker，避免誤用快取訊號。

## 上傳 GitHub 並啟用 Pages

1. 在 GitHub 建立新的儲存庫，例如 `0050-detector`。若要最簡單使用免費Pages，使用公有儲存庫；私有Pages視帳戶方案而定。
2. **上傳這個資料夾裡的內容到儲存庫根目錄**，包括 `.github`、`scripts`、`site`、`tests`、README。不要再多包一層 `0050-detector-Codex`，也不要只上傳HTML。可用GitHub Desktop或Git命令。
3. 預設分支使用 `main`；其他分支名需同步修改 `.github/workflows/pages.yml` 的push分支。
4. 在儲存庫 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
5. 到 **Actions → Update 0050 data and deploy Pages → Run workflow**，選main執行。若GitHub要求啟用Actions，先啟用。
6. 等deploy成功；Actions執行頁面與Settings → Pages會顯示網址，通常是 `https://你的帳號.github.io/0050-detector/`。用手機開啟該網址。

若習慣Git，先在**本套件資料夾內**執行；remote請替換成自己的儲存庫，不要在整個Stock_analysis根目錄執行：

```sh
git init -b main
git add .
git commit -m "Add 0050 support detector"
git remote add origin https://github.com/YOUR_ACCOUNT/0050-detector.git
git push -u origin main
```

**只上傳本套件。** 不需上傳既有 `titan.db`、token檔、其他股票專案或私人報告。網站只部署 `site/`，GitHub憑證由平台提供，程式不保存個人密鑰。

## 更新方式

2026-09-18修正：Yahoo偶爾出現中間交易日close／adjclose空值。價格仍採證交所實際OHLC；僅在前後7日內有有效、相同調整比例且期間無股息／分割等事件時補調整比例，並於資料註記補齊日期。不補價格、不跨公司行動、不外推缺少鄰值的最新日。其餘不安全情況仍停止發布。

- Workflow在台灣時間週一至週五16:35、18:35、21:35（UTC08:35、10:35、13:35）嘗試更新；另支援main推送與手動執行。
- 下載約430個日曆日內的Yahoo日線調整比例，再逐月向證交所讀取0050實際交易日及OHLC。非交易填補列不進入網站；缺少調整比例或明顯價格不一致則整次失敗。
- 只使用完整收盤資料；台灣時間15:00前執行時不納入當天。休市或假日不製造新資料。
- 更新與測試成功後才發布。失敗時不以套件舊快照覆蓋既有網站，既有已發布版本仍保留；首次部署失敗則尚無網站。請查看Actions紅色步驟資訊後重新執行。
- 網頁「重新載入資料」只重開已發布網頁，不會啟動GitHub更新。請以頁面標示的最新行情日為準。
- GitHub排程可能延遲；公有儲存庫60日沒有活動可能自動停用定時工作。屆時到Actions啟用／手動執行；不要假定它永遠準時。
- Yahoo／證交所沒有在本程式承諾服務可用性。若任一資料源拒絕GitHub伺服器請求，需重試或調整資料管道，不應靜默改用過期資料冒充最新。

## 畫面用法

1. 看最新資料日期。選歷史日期時，上方會標示歷史模式。
2. 選MA卡片，查看七項條件逐項通過／失敗；候選成立不是交易指令。
3. 直接版與等待確認版的原訊號日期可能不同，風險價也不同。先選部位試算的風險價來源。
4. 自行輸入帳戶新臺幣金額與預估／實際下一交易日開盤價。沒有開盤價時不以收盤自動代替。
5. 讀取風險距離、取消理由與估計股數；該股數不包含你的既有持倉，帳戶風險須自行管理。

## 規則與單位

新增「額外確認」觀察區：MA20、MA21分別檢查連續2／3／5／10個交易日上升，預設3日。包含選定日收盤，N次上升需N+1筆均線值，每次嚴格大於前次，平盤不通過。顯示任一條通過（OR）和兩條皆通過（AND），沒有指定其中一種為交易濾網。**此條件未回測，不改原候選、確認訊號或部位；原回測績效不代表加入此條件後的績效。** 程式的正確性測試不是策略績效回測。

目標均線M一律取前一交易日值；當日最低價在M×[0.98,1.02]、收盤≥M，且前日收盤≥M；目標均線與MA60相對五交易日前上揚，當日收盤≥前日MA60。包含盘中穿越最多2%，收盤須收復。

S＝原訊號日最低價−0.5×前日ATR14。ATR是14日真實波幅簡單平均。O≤S或(O−S)/O>8%取消。資金比例=min(25%,0.5%/max((O−S)/O,2%))；買入成本0.10%包含在預算中，股數向下取整。

0.5%是預算，不是最大損失保證。破位退出版為收盤<S、次日開盤退出；直接20日版只以S配置部位。工具沒有自動計算20日退出、8%帳戶停機或券商可成交價格。

網站訊號引擎使用分割配息調整OHLC。卡片與試算將同一比例的風險價轉回選定日的Yahoo分割後報價等值；最新交易日通常就是目前每股新臺幣價位。**歷史日期不代表當時未分割的實際委託股價，若次日跨除息／分割必須另換算，不能直接使用試算股數下單。** 圖表保留調整後單位並明示日期與單位。

## 開發與測試

Python3.9以上＋Node18以上，無第三方執行依賴。

```sh
python scripts/update_data.py
node tests/engine.test.cjs
node tests/data.test.cjs
```

程式：`site/engine.js`（純計算）、`site/app.js`（介面）、`scripts/update_data.py`（資料）、`.github/workflows/pages.yml`（更新及部署）。

已執行計算測試與真實資料更新；未在使用者GitHub帳戶部署。工具環境阻擋本機file URL瀏覽器自動化，手機／瀏覽器實際畫面仍需在發布網址確認。CSS包含760px以下手機版、可觸控控件與縮放圖表。

官方部署文件：[GitHub Pages自訂Workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[排程事件限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)。
