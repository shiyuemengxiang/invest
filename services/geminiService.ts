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
  
  // 1. 基础资产概况
  const portfolioSummary = items.map(item => {
    const m = calculateItemMetrics(item);
    return {
      name: item.name,
      amount: item.principal,
      currency: item.currency,
      type: item.type,
      category: item.category,
      days: m.realDurationDays,
      yield: m.comprehensiveYield.toFixed(2) + "%",
      status: m.isCompleted ? "Finished" : "Active",
      maturity: item.maturityDate
    };
  });

  // 2. 🔥 核心升级：计算未来 30 天的现金流 (模拟日历视图逻辑)
  const now = new Date();
  const next30Days = new Date();
  next30Days.setDate(now.getDate() + 30);

  const upcomingCashFlows = items
    .filter(item => {
        // 筛选未完结且有到期日的
        if (item.withdrawalDate || !item.maturityDate) return false;
        const matDate = new Date(item.maturityDate);
        return matDate >= now && matDate <= next30Days;
    })
    .map(item => {
        const m = calculateItemMetrics(item);
        // 估算回款 = 本金 + 预估收益 + 返利 (如果不扣除)
        // 这里给 AI 一个大致的 liquidity 概念
        const estimatedTotal = item.principal + m.profit + (item.isRebateReceived ? 0 : item.rebate);
        return {
            date: item.maturityDate,
            name: item.name,
            amount: estimatedTotal.toFixed(2),
            currency: item.currency
        };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 3. 构建增强版 Prompt
  const prompt = `
    You are a professional financial advisor. Analyze the following personal investment ledger summary.
    
    **1. Portfolio Overview:**
    - Total Invested: ${stats.totalInvested}
    - Active Principal: ${stats.activePrincipal}
    - Weighted Avg Yield: ${stats.comprehensiveYield.toFixed(2)}%
    
    **2. ⚠️ Liquidity Alert (Upcoming Maturities in 30 Days):**
    ${upcomingCashFlows.length > 0 ? JSON.stringify(upcomingCashFlows) : "No major maturities in the next 30 days."}

    **3. Detailed Items (Active & Recent):**
    ${JSON.stringify(portfolioSummary.slice(0, 15))} 

    Please provide a concise analysis in **Simplified Chinese (zh-CN)** covering:
    
    1.  **流动性与现金流 (Liquidity)**: 
        - Based on the "Liquidity Alert" section, specifically mention if any large funds are freeing up soon (dates and amounts). 
        - Give advice on re-investment preparation.
    2.  **投资组合健康度 (Health)**: 
        - Comment on the weighted yield (${stats.comprehensiveYield.toFixed(2)}%). Is it aggressive or conservative?
    3.  **风险提示 (Risk)**: 
        - Check for "Maturity Clumping" (too many items ending same day).
        - Check for currency concentration.
    4.  **优化建议 (Optimization)**: 
        - How to improve yield? (e.g. check rebates, adjust duration).
    
    **Format:** Use Markdown with bolding for key figures. Keep it encouraging but professional.
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

// 日历视图专用的月度分析接口
export const getMonthlyCashFlowAnalysis = async (events: any[], year: number, month: number) => {
    const ai = getAiClient();

    // 简化事件数据
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
      1. **📅 关键日期**: 哪天有大额回款(Settlement)？
      2. **💰 收支概况**: 本月是净投入还是净回款？
      3. **💡 操作建议**: 针对回款资金的建议。
      
      保持简洁。
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