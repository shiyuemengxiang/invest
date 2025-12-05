import { GoogleGenAI } from "@google/genai";
import { Investment } from "../types";
import { calculateItemMetrics, calculatePortfolioStats, formatCurrency } from "../utils";

const getAiClient = () => {
    if (!process.env.API_KEY) {
        throw new Error("API Key is missing");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const getAIAnalysis = async (items: Investment[]) => {
  const ai = getAiClient();
  const stats = calculatePortfolioStats(items);
  
  // 1. 基础资产概况 (数据增强)
  const portfolioSummary = items.map(item => {
    const m = calculateItemMetrics(item);
    return {
      name: item.name,
      amount: item.principal,
      currency: item.currency,
      type: item.type,
      category: item.category,
      days: m.realDurationDays,
      // 🔥 关键修改：明确区分持仓收益率与年化收益率
      holdingYield: m.holdingYield.toFixed(2) + "%",       // 绝对收益率 (Total Return)
      annualizedYield: m.comprehensiveYield.toFixed(2) + "%", // 年化收益率 (Annualized / CAGR)
      status: m.isCompleted ? "Finished" : "Active",
      maturity: item.maturityDate
    };
  });

  // 2. 现金流逻辑 (保持不变)
  const now = new Date();
  now.setHours(0, 0, 0, 0); 

  const upcomingCashFlows = items
    .filter(item => {
        if (item.withdrawalDate || !item.maturityDate) return false;
        const matDate = new Date(item.maturityDate);
        return matDate >= now;
    })
    .map(item => {
        const m = calculateItemMetrics(item);
        const estimatedTotal = item.principal + m.profit + (item.isRebateReceived ? 0 : item.rebate);
        return {
            date: item.maturityDate,
            name: item.name,
            amount: estimatedTotal.toFixed(2),
            currency: item.currency,
            daysLeft: Math.ceil((new Date(item.maturityDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  // 3. 构建 Prompt (指令增强)
  const prompt = `
    You are a professional financial advisor. Analyze the following personal investment ledger summary.
    
    **1. Portfolio Overview:**
    - Total Invested: ${stats.totalInvested}
    - Active Principal: ${stats.activePrincipal}
    - Weighted Avg Annualized Yield: ${stats.comprehensiveYield.toFixed(2)}% (MWR)
    
    **2. ⚠️ Liquidity Alert (Next 5 Upcoming Maturities):**
    ${upcomingCashFlows.length > 0 ? JSON.stringify(upcomingCashFlows) : "No upcoming maturities found."}

    **3. Detailed Items (Snapshot):**
    ${JSON.stringify(portfolioSummary.slice(0, 15))} 

    Please provide a concise analysis in **Simplified Chinese (zh-CN)** covering:
    
    1.  **流动性与现金流 (Liquidity)**: 
        - Analyze the "Liquidity Alert" section. List dates and amounts of next big maturities.
    
    2.  **投资组合健康度 (Health)**: 
        - Comment on the weighted annualized yield (${stats.comprehensiveYield.toFixed(2)}%).
    
    3.  **收益深度解析 (Yield Analysis)**: 
        - **CRITICAL**: When analyzing items, strictly distinguish between **"Holding Yield" (持仓收益率/绝对回报)** and **"Annualized Yield" (年化收益率/资金效率)**.
        - Example: If an item has 50% holding yield but over 5 years, point out its low annualized efficiency. If an item has 2% holding yield in 5 days, highlight its high annualized efficiency.
        - Identify any "high holding yield" items and verify if their "annualized yield" justifies the duration.
        
    4.  **风险提示 (Risk)**: 
        - Maturity Clumping & Currency risks.
        
    5.  **优化建议 (Optimization)**: 
        - Practical advice.
    
    **Format:** Use Markdown. Use Emojis. Be direct.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI分析暂时不可用，请检查网络或 Key 设置。";
  }
};

// ... (getMonthlyCashFlowAnalysis 保持不变)
export const getMonthlyCashFlowAnalysis = async (events: any[], year: number, month: number) => {
    const ai = getAiClient();

    const simplifiedEvents = events.map(e => ({
        date: e.date,
        type: e.type,
        name: e.name,
        amount: e.amount,
        currency: e.currency,
        isReceived: e.isReceived
    }));

    const prompt = `
      你是一位贴心的私人理财助理。请根据以下 **${year}年${month}月** 的账本现金流事件，为我生成一份简短的月度资金规划简报。
      
      **本月事件列表:**
      ${JSON.stringify(simplifiedEvents)}
      
      请用 **中文简体** 回答，重点关注：
      1. 📅 **关键日期**: 哪天有大额回款(Settlement)？
      2. 💰 **收支概况**: 本月是净投入还是净回款？
      3. 💡 **操作建议**: 针对回款资金的建议。
      
      保持简洁。使用 Emoji。
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Gemini Calendar Analysis Error:", error);
        return "AI 现金流分析暂时不可用。";
    }
};