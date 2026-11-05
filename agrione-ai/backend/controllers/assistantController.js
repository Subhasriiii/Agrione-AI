const KNOWLEDGE_BASE = {
  crop_selection: {
    keywords: ['which crop', 'what crop', 'crop suitable', 'best crop', 'grow what', 'recommend crop'],
    response: 'Crop selection depends on your soil type, climate, season, and water availability. Use the Crop Recommendation module to get personalized suggestions based on your soil parameters (N, P, K, pH), temperature, humidity, and rainfall. For kharif season (June-October), consider rice, maize, cotton, or soybean. For rabi season (October-March), consider wheat, chickpea, mustard, or potato.',
  },
  soil_health: {
    keywords: ['soil health', 'improve soil', 'soil quality', 'soil nutrients', 'soil test'],
    response: 'To improve soil health: 1) Get regular soil testing done (at least annually). 2) Maintain pH between 6.0-7.5 using lime or gypsum as needed. 3) Add organic matter through compost or green manure. 4) Practice crop rotation to prevent nutrient depletion. 5) Avoid excessive chemical fertilizers. 6) Use the Soil Intelligence module to analyze your current soil parameters.',
  },
  irrigation: {
    keywords: ['irrigation', 'water', 'watering', 'moisture', 'drought', 'dry soil'],
    response: 'Efficient irrigation practices: 1) Use drip irrigation to save 30-60% water. 2) Water early morning or late evening to reduce evaporation. 3) Monitor soil moisture regularly. 4) Apply mulch to retain soil moisture. 5) Use the Smart Irrigation module for personalized recommendations based on your crop and soil conditions.',
  },
  disease: {
    keywords: ['disease', 'pest', 'leaf color', 'yellow leaves', 'spots', 'wilting', 'infection'],
    response: 'If you notice leaf discoloration or spots: 1) Use the Disease Detection module to upload a photo of the affected leaf. 2) Check for common signs — yellowing (nutrient deficiency), brown spots (fungal), white powder (mildew). 3) Maintain proper spacing between plants. 4) Use neem-based sprays as a first measure. 5) Consult your local agricultural officer for severe cases. Always verify AI predictions with an expert.',
  },
  fertilizer: {
    keywords: ['fertilizer', 'manure', 'nutrient', 'NPK', 'urea', 'nitrogen'],
    response: 'Fertilizer guidelines: 1) Test soil before applying fertilizers. 2) Use balanced NPK based on soil test results. 3) Urea provides nitrogen — apply in split doses. 4) DAP provides phosphorus — apply at sowing. 5) MOP provides potassium — apply during growth stage. 6) Consider organic alternatives like vermicompost. Always follow recommended doses to avoid over-fertilization.',
  },
  schemes: {
    keywords: ['scheme', 'government', 'subsidy', 'loan', 'PM', 'kisan', 'insurance'],
    response: 'Check the Government Schemes page for current schemes. Key national schemes include: PM-KISAN (income support), PMFBY (crop insurance), Soil Health Card Scheme, KCC (Kisan Credit Card), and eNAM (market platform). Visit your local agriculture office or Common Service Center (CSC) for scheme applications.',
  },
  market: {
    keywords: ['market', 'price', 'sell', 'buyer', 'mandi', 'selling price'],
    response: 'For market information: 1) Check the Market page for current indicative prices. 2) Use the Marketplace to list your produce for buyers. 3) Compare prices across different mandis. 4) Consider APMC mandis and eNAM platform for better prices. 5) Store produce properly to avoid post-harvest losses.',
  },
  weather: {
    keywords: ['weather', 'rain', 'temperature', 'forecast', 'monsoon', 'climate'],
    response: 'Check the Weather module for current conditions at your farm location. Weather planning tips: 1) Plan sowing around expected monsoon arrival. 2) Protect crops before heavy rainfall. 3) Ensure drainage during excessive rain. 4) Provide shade or extra irrigation during heat waves.',
  },
};

exports.chat = async (req, res) => {
  try {
    const { message, farmContext } = req.body || {};

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter a question.' });
    }

    const query = message.trim().toLowerCase();
    const question = message.trim();

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are an agricultural advisor for Indian farmers. Answer the following farming question concisely and helpfully. If farm context is available, use it. Never give dangerous advice. Always suggest consulting local experts for critical decisions.\n\nFarm Context: ${farmContext ? JSON.stringify(farmContext) : 'Not available'}\n\nFarmer's Question: ${question}`
                }]
              }]
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const parts = data?.candidates?.[0]?.content?.parts;
          const aiResponse = Array.isArray(parts)
            ? parts
              .map((part) => (typeof part?.text === 'string' ? part.text : ''))
              .filter(Boolean)
              .join('\n')
              .trim()
            : '';

          if (aiResponse) {
            return res.json({
              success: true,
              response: aiResponse,
              source: 'Gemini 3.6 Flash',
              isAI: true,
            });
          }
        }
      } catch {
        // Use the predefined knowledge base when Gemini is unavailable.
      } finally {
        clearTimeout(timeout);
      }
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const [topic, data] of Object.entries(KNOWLEDGE_BASE)) {
      const matchCount = data.keywords.filter(kw => query.includes(kw)).length;
      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestMatch = data;
      }
    }

    if (bestMatch) {
      return res.json({
        success: true,
        response: bestMatch.response,
        source: 'Predefined Agricultural Knowledge Base',
        isAI: false,
        note: 'This is predefined agricultural guidance, not a Gemini-generated response.',
      });
    }

    return res.json({
      success: true,
      response: "I don't have predefined guidance for that question, and Gemini is currently unavailable. Please try asking about crop selection, soil health, irrigation, diseases, fertilizers, government schemes, markets, or weather, or consult a local agricultural expert.",
      source: 'Unsupported question response',
      isAI: false,
      note: 'This is a predefined notice, not an AI-generated answer.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Assistant service failed.' });
  }
};



