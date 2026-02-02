export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // 兼容不同的 D1 綁定名稱
    const database = env.DB || env.bothire_db;
    if (!database) return Response.json({ error: "D1_BINDING_MISSING" }, { status: 500 });

    const url = new URL(request.url);

    // 1. 公開 Dashboard 路由 (無需驗證，支援 UTF-8)
    if (url.pathname === "/dashboard") {
      const { results } = await database.prepare(
        "SELECT agent_id, budget, status, created_at FROM deals ORDER BY created_at DESC LIMIT 50"
      ).all();

      const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>BotHire Nexus Monitor</title>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <style>
            body { font-family: sans-serif; background: #121212; color: white; padding: 20px; }
            .container { max-width: 900px; margin: auto; background: #1e1e1e; padding: 20px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
            h1 { color: #00ffa3; text-align: center; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 0.8em; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📊 Market Pulse: Recent 50 Deals</h1>
            <canvas id="marketChart"></canvas>
            <div class="footer">Real-time data powered by Cloudflare D1 & BotHire Nexus Core</div>
          </div>
          <script>
            const rawData = ${JSON.stringify(results || [])};
            const data = rawData.reverse();
            const ctx = document.getElementById('marketChart').getContext('2d');
            new Chart(ctx, {
              type: 'line',
              data: {
                labels: data.map(d => new Date(d.created_at).toLocaleTimeString()),
                datasets: [{
                  label: 'Bid Price (SOL)',
                  data: data.map(d => d.budget),
                  borderColor: '#00ffa3',
                  backgroundColor: 'rgba(0, 255, 163, 0.1)',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 4,
                  pointBackgroundColor: '#00ffa3'
                }]
              },
              options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#fff' } } },
                scales: {
                  y: { grid: { color: '#333' }, ticks: { color: '#aaa' }, beginAtZero: false },
                  x: { grid: { color: '#333' }, ticks: { color: '#aaa' } }
                }
              }
            });
          </script>
        </body>
      </html>`;
      
      return new Response(html, { 
        headers: { "Content-Type": "text/html; charset=utf-8" } 
      });
    }

    // 2. 安全驗證區塊 (API 專用)
    const authKey = request.headers.get("X-BotHire-Key");
    if (authKey !== "bothire_admin_secret_8020") {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      // 談判接口
      if (url.pathname === "/v1/negotiate" && request.method === "POST") {
        const { budget, agent_id } = await request.json() as any;
        
        // 獲取市場平均價
        const stats = await database.prepare(
          "SELECT AVG(negotiated_price) as avg_price FROM deals WHERE status = 'ACCEPTED' AND negotiated_price > 0"
        ).first();

        const marketAvg = (stats?.avg_price as number) || 0.12;
        const dynamicFloor = marketAvg * 0.9;
        const isAccepted = budget >= dynamicFloor;

        // 紀錄交易
        await database.prepare(
          "INSERT INTO deals (agent_id, budget, negotiated_price, status) VALUES (?, ?, ?, ?)"
        ).bind(agent_id, budget, isAccepted ? budget : 0, isAccepted ? 'ACCEPTED' : 'REJECTED').run();

        return Response.json({
          status: isAccepted ? "ACCEPTED" : "REJECTED",
          negotiated_price: isAccepted ? budget : 0,
          dynamic_floor_used: dynamicFloor.toFixed(4)
        });
      }
    } catch (err: any) {
      return Response.json({ error: "Runtime Error", details: err.message }, { status: 500 });
    }

    return new Response("Not Found", { status: 404 });
  }
};
