import { GoogleGenAI } from "@google/genai";
import { Investment } from "../types";
import { calculateItemMetrics, calculatePortfolioStats } from "../utils";

export const getAIAnalysis = async (items: Investment[]) => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const stats = calculatePortfolioStats(items);
  
  // Anonymize and simplify data for AI
  const portfolioSummary = items.map(item => {
    const m = calculateItemMetrics(item);
    return {
      name: item.name,
      amount: item.principal,
      days: m.realDurationDays,
      yield: m.comprehensiveYield.toFixed(2) + "%",
      status: m.isCompleted ? "Finished" : "Active",
      maturity: item.maturityDate
    };
  });

  const prompt = `
    You are a professional financial advisor. Analyze the following personal investment ledger summary.
    
    Portfolio Overview:
    - Total Invested: ${stats.totalInvested}
    - Active Principal: ${stats.activePrincipal}
    - Weighted Avg Yield: ${stats.comprehensiveYield.toFixed(2)}%
    
    Detailed Items (Anonymized):
    ${JSON.stringify(portfolioSummary.slice(0, 15))} ${(portfolioSummary.length > 15 ? `...and ${portfolioSummary.length - 15} more` : '')}

    Please provide a concise analysis in Simplified Chinese (zh-CN) covering:
    1. **Portfolio Health**: Assessment of liquidity and yield.
    2. **Risk Alert**: Are there too many maturities clumping together?
    3. **Optimization**: Suggestions to improve comprehensive yield (e.g., maximizing rebates or adjusting duration).
    
    Keep it encouraging but professional. Format with Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI分析暂时不可用，请稍后再试。";
  }
};
