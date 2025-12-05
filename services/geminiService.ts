import { GoogleGenAI } from "@google/genai";
import { Investment } from "../types";
import { calculateItemMetrics, calculatePortfolioStats } from "../utils";

const getAiClient = () => {
    if (!process.env.API_KEY) {
        throw new Error("API Key is missing");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const getAIAnalysis = async (items: Investment[]) => {
  const ai = getAiClient();
  const stats = calculatePortfolioStats(items);
  
  // 1. 基础资产概况 (简化数据以节省 Token)
  const portfolioSummary = items.map(item => {
    const m = calculateItemMetrics(item);
    return {
      n: item.name, // 简写 name
      a: item.principal, // 简写 amount
      c: item.currency,
      t: item.type,
      d: m.realDurationDays, // 简写 days
      y: m.comprehensiveYield.toFixed(2) + "%", // yield
      end: item.maturityDate || item.withdrawalDate // 到期日
    };
  });

  // 2. 构建增强版 Prompt
  const prompt = `
    你是一位经验丰富且风趣的私人理财顾问。请根据用户的投资账本生成一份简短、犀利的诊断报告。

    **资产概况:**
    - 总投入: ${stats.totalInvested.toFixed(0)}
    - 综合年化: ${stats.comprehensiveYield.toFixed(2)}% (非常关键的指标)
    - 持仓明细: ${JSON.stringify(portfolioSummary.slice(0, 20))}

    请用 **中文简体** 回答，采用以下结构（使用 Markdown 格式，多用 Emoji 🌟）：

    ### 1. 🩺 资产体检
    用一句话点评当前的综合年化收益率（MWR）。是"跑赢通胀"、"稳健增值"还是"激进高收益"？

    ### 2. 💡 机会与风险
    - **流动性**: 未来30天是否有大额资金到期？(具体到日期和金额)
    - **风险**: 是否过度集中在某些高风险产品？
    
    ### 3. 🚀 搞钱建议
    给出1-2条具体的优化建议（例如：建议配置更多固收以平衡风险，或者注意某笔即将到期的资金复投）。

    **要求：**
    - 语气亲切自然，像朋友聊天。
    - 重点数据请使用 **加粗** 标记。
    - 总字数控制在 300 字以内，不要长篇大论。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 助手正在休息，请稍后再试。";
  }
};

// ... (getMonthlyCashFlowAnalysis 保持不变或按需微调)
export const getMonthlyCashFlowAnalysis = async (events: any[], year: number, month: number) => {
    // (保持原有的代码逻辑即可，或者也加上 Emoji 优化)
    const ai = getAiClient();
    const simplifiedEvents = events.map(e => ({
        d: e.date, t: e.type, n: e.name, a: e.amount, c: e.currency
    }));

    const prompt = `
      作为理财助理，请分析 ${year}年${month}月 的现金流。
      数据: ${JSON.stringify(simplifiedEvents)}
      
      请用中文简体回答：
      1. 📅 **关键日**: 哪天有大额回款？
      2. 💰 **收支**: 本月是净投入还是净回款？
      3. 📝 **建议**: 简短的操作建议。
      使用 Emoji，保持简洁。
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Gemini Calendar Analysis Error:", error);
        return "AI 分析暂时不可用。";
    }
};