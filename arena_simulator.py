#!/usr/bin/env python3
import requests
import json
import sys
import time
import random
from solders.keypair import Keypair

# 配置
WORKER_URL = "https://bothire-bot.kwailapt.workers.dev"
AUTH_KEY = "bothire_admin_secret_8020"

def get_strategy_bid(strategy_name):
    """根據不同代理性格決定報價"""
    base_price = 0.11
    if strategy_name == "aggressive":
        return round(base_price + random.uniform(0.02, 0.05), 4)
    elif strategy_name == "patient":
        return round(base_price + random.uniform(0.001, 0.01), 4)
    else:
        return round(base_price + random.uniform(0.01, 0.03), 4)

def run_agent(agent_id, strategy):
    print(f"🤖 [Agent {agent_id}] 啟動策略: {strategy}")
    bid = get_strategy_bid(strategy)
    print(f"💰 [Agent {agent_id}] 提交報價: {bid} SOL")
    
    # 提交至 Cloudflare Worker 進行裁決
    payload = {"budget": bid, "agent_id": agent_id, "strategy": strategy}
    res = requests.post(f"{WORKER_URL}/v1/negotiate", 
                       json=payload, 
                       headers={"X-BotHire-Key": AUTH_KEY})
    
    if res.status_code == 200:
        result = res.json()
        status = result.get("status")
        print(f"📢 [Worker 裁決] Agent {agent_id}: {status}")
        if status == "ACCEPTED":
            print(f"✅ 成交！價格: {result.get('negotiated_price')} SOL")
    else:
        print(f"❌ 請求失敗: {res.text}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 arena_simulator.py <agent_id> <strategy>")
    else:
        run_agent(sys.argv[1], sys.argv[2])
