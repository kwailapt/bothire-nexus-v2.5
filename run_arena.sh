#!/bin/bash
# 1. 進入虛擬環境
source venv/bin/activate

echo "🏁 啟動 BotHire 多代理算力競標對抗 (Venv Mode)..."
echo "--------------------------------------"

# 2. 啟動不同策略的代理
python3 arena_simulator.py "Agent_Patient" "patient" &
python3 arena_simulator.py "Agent_Aggressive" "aggressive" &
python3 arena_simulator.py "Agent_Standard" "normal" &

# 等待所有背景進程結束
wait
echo "--------------------------------------"
echo "⚖️ 所有代理交易嘗試結束。請檢查 Worker/D1 歷史紀錄。"
