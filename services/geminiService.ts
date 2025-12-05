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
  
  // 1. 基础资产概况 (用于展示列表)
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

  // 2. 🔥 核心修复：不再限制"30天内"，而是获取"未来最近即将到期"的前 5 笔
  const now = new Date();
  now.setHours(0, 0, 0, 0); // 忽略时分秒，只比日期

  const upcomingCashFlows = items
    .filter(item => {
        // 筛选条件：未完结 + 有到期日 + 到期日是今天或未来
        if (item.withdrawalDate || !item.maturityDate) return false;
        const matDate = new Date(item.maturityDate);
        return matDate >= now;
    })
    .map(item => {
        const m = calculateItemMetrics(item);
        // 估算回款 = 本金 + 预估收益 + 待收返利
        const estimatedTotal = item.principal + m.profit + (item.isRebateReceived ? 0 : item.rebate);
        return {
            date: item.maturityDate,
            name: item.name,
            amount: estimatedTotal.toFixed(2),
            currency: item.currency,
            daysLeft: Math.ceil((new Date(item.maturityDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // 按时间正序排列（最近的在前）
    .slice(0, 5); // 🔥 关键：只取最近的 5 笔，无论它们是一周后还是明年

  // 3. 构建 Prompt
  const prompt = `
    You are a professional financial advisor. Analyze the following personal investment ledger summary.
    
    **1. Portfolio Overview:**
    - Total Invested: ${stats.totalInvested}
    - Active Principal: ${stats.activePrincipal}
    - Weighted Avg Yield: ${stats.comprehensiveYield.toFixed(2)}%
    
    **2. ⚠️ Liquidity Alert (Next 5 Upcoming Maturities):**
    ${upcomingCashFlows.length > 0 ? JSON.stringify(upcomingCashFlows) : "No upcoming maturities found."}

    **3. Detailed Items (Snapshot):**
    ${JSON.stringify(portfolioSummary.slice(0, 15))} 

    Please provide a concise analysis in **Simplified Chinese (zh-CN)** covering:
    
    1.  **流动性与现金流 (Liquidity)**: 
        - **Crucial**: Analyze the "Liquidity Alert" section. Explicitly list the dates and amounts of the next big maturities.
        - Treat these dates as the most critical upcoming cash flow events, even if they are months away.
        - Mention how many days are left for the nearest one.
    2.  **投资组合健康度 (Health)**: 
        - Comment on the weighted yield (${stats.comprehensiveYield.toFixed(2)}%).
    3.  **风险提示 (Risk)**: 
        - Check for "Maturity Clumping" (dates close to each other).
        - Currency risks.
    4.  **优化建议 (Optimization)**: 
        - Practical advice for re-investment.
    
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

// 日历视图专用的月度分析接口
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