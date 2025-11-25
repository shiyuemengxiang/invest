
export default async function handler(request: any, response: any) {
  // Default fallback rates
  const fallbackRates = {
      CNY: 1,
      USD: 7.25, 
      HKD: 0.93
  };

  try {
    // 1. Fetch from open.er-api.com (Base CNY)
    // Returns: 1 CNY = X Target Currency
    const res = await fetch('https://open.er-api.com/v6/latest/CNY');
    console.log(res)
    if (!res.ok) {
        throw new Error(`Exchange API failed: ${res.status}`);
    }

    const data = await res.json();
    
    if (data && data.rates) {
        // Invert rates because system expects "Value of 1 Unit in CNY"
        // API gives: 1 CNY = 0.138 USD -> We want: 1 USD = 1/0.138 = 7.24 CNY
        const usdRate = data.rates.USD ? 1 / data.rates.USD : fallbackRates.USD;
        const hkdRate = data.rates.HKD ? 1 / data.rates.HKD : fallbackRates.HKD;

        const newRates = {
            CNY: 1,
            USD: parseFloat(usdRate.toFixed(4)),
            HKD: parseFloat(hkdRate.toFixed(4))
        };
        
        return response.status(200).json(newRates);
    }
    
    throw new Error('Invalid data format from Exchange API');
  } catch (error: any) {
    console.error("Market Rates API Error:", error.message);
    // Return fallback rates instead of 500 to keep app functional
    return response.status(200).json(fallbackRates);
  }
}
