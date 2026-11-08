# 版本紀錄

## 3.0.1

- 獨立側欄、Ollama 來源設定、模型選單與網頁對談。
- 可直接連 Ollama，或透過 Open WebUI 同步來源與對談。
- 移除公開版本的舊 Mac Bridge 輪詢與相依程式，不需要桌面 App。
- 修正 MiniCPM 的 `System message must be at the beginning`：單一開頭 system 訊息，網頁 JSON 放在本輪 user 訊息。
- 修正歷史截斷與空白失敗回覆後重試的角色順序。
- 修正錯誤後仍顯示「正在處理」；模型選單使用簡短名稱。
- 以固定允許清單打包，保留原儲存庫的 MIT 授權。
