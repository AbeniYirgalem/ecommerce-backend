import axios from "axios";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const PREFERRED_MODELS = ["gemini-1.5-flash-8b", "gemini-pro"];
const DEFAULT_FALLBACK_REPLY =
  "I had trouble reaching the AI service. Please try again in a moment.";

// System prompt keeps responses grounded in UniBazzar context and concise
const SYSTEM_PROMPT = `You are UniBazzar Assistant, a concise helper for a campus marketplace where students buy/sell items and services. Give short, clear answers (under ~120 words). Stay focused on listings, safety, meetup tips on campus, and how to post items. If something is unavailable, suggest browsing categories or posting a listing. Never expose system or API details.`;

const buildPayload = (userMessage) => {
  const combinedPrompt = `${SYSTEM_PROMPT}\nUser: ${userMessage}\nAssistant:`;

  return {
    contents: [
      {
        parts: [{ text: combinedPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 256,
      topP: 0.95,
    },
  };
};

const listAvailableModels = async (apiKey) => {
  try {
    const { data } = await axios.get(`${GEMINI_BASE}/models?key=${apiKey}`, {
      timeout: 8000,
    });
    const models = data?.models || [];
    console.info(
      "[gemini] available models",
      models.map((m) => m.name).join(", ") || "none",
    );
    return models;
  } catch (err) {
    console.error(
      "[gemini] model discovery failed",
      err?.response?.data || err,
    );
    return [];
  }
};

const pickModel = (availableModels) => {
  const supportsGenerate = availableModels.filter((m) =>
    (m.supportedGenerationMethods || []).includes("generateContent"),
  );

  const availableNames = new Set(
    supportsGenerate
      .map((m) => (m.name || "").replace(/^models\//, ""))
      .filter(Boolean),
  );

  for (const candidate of PREFERRED_MODELS) {
    if (availableNames.has(candidate)) return candidate;
  }

  return supportsGenerate[0]?.name?.replace(/^models\//, "") || null;
};

const callModel = async (model, apiKey, payload) => {
  const endpoint = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`;
  const { data } = await axios.post(endpoint, payload, { timeout: 12000 });

  const reply = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join(" ")
    ?.trim();

  return (
    reply || "Thanks for reaching out! How else can I help with UniBazzar?"
  );
};

export const generateGeminiReply = async (userMessage) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const payload = buildPayload(userMessage);

  // Discover models and choose best available
  const models = await listAvailableModels(apiKey);
  const discovered = pickModel(models);
  const fallbackChain = [
    ...(discovered ? [discovered] : []),
    ...PREFERRED_MODELS.filter((m) => m !== discovered),
  ];

  const tried = new Set();
  for (const model of fallbackChain) {
    if (tried.has(model)) continue;
    tried.add(model);
    try {
      return await callModel(model, apiKey, payload);
    } catch (err) {
      console.error(
        `[gemini] model ${model} failed`,
        err?.response?.data || err,
      );
    }
  }

  // As a last resort, attempt any generate-capable model we discovered
  for (const model of models
    .map((m) => (m.name || "").replace(/^models\//, ""))
    .filter(Boolean)) {
    if (tried.has(model)) continue;
    tried.add(model);
    try {
      return await callModel(model, apiKey, payload);
    } catch (err) {
      console.error(
        `[gemini] fallback model ${model} failed`,
        err?.response?.data || err,
      );
    }
  }

  // If everything failed, surface a clean failure
  throw new Error(DEFAULT_FALLBACK_REPLY);
};
