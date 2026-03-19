import Listing from "../models/Listing.model.js";
import { generateGeminiReply } from "../services/gemini.service.js";

const getFrontendBase = () => {
  const raw = process.env.CLIENT_URL || "http://localhost:5173";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

const GREETING_KEYWORDS = ["hello", "hi", "hey", "hola", "yo", "sup"];

const ABOUT_KEYWORDS = [
  "who are you",
  "what are you",
  "who is unibazzar",
  "who built you",
  "your name",
  "what can you do",
  "how can you help",
  "what do you do",
];

const HELP_KEYWORDS = [
  "how to sell",
  "how do i sell",
  "how can i sell",
  "want to sell",
  "looking to sell",
  "selling",
  "post item",
  "post product",
  "post listing",
  "create listing",
  "list item",
  "upload item",
  "fees",
  "is it safe",
  "how it works",
  "how does it work",
  "deliver",
  "pickup",
];

const PRICE_KEYWORDS = {
  cheap: ["cheap", "budget", "affordable", "low", "lower", "under"],
  expensive: ["expensive", "premium", "high-end", "high end", "pricy"],
};

const CATEGORY_KEYWORDS = {
  Electronics: [
    "electronics",
    "gadget",
    "camera",
    "headphones",
    "earbuds",
    "monitor",
    "keyboard",
    "mouse",
    "charger",
    "tablet",
    "ipad",
    "printer",
    "laptop",
    "notebook",
    "macbook",
    "phone",
    "iphone",
    "android",
    "mobile",
    "smartphone",
  ],
  Textbooks: ["book", "textbook", "novel", "guide"],
  Clothes: ["clothes", "clothing", "hoodie", "jacket", "shirt", "pants"],
  Stationery: ["stationery", "calculator", "pen", "notebook"],
  Dormitory: ["furniture", "chair", "table", "desk", "sofa", "bed"],
  Other: ["bike", "bicycle", "service", "tutor", "repair"],
};

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "for",
  "and",
  "with",
  "about",
  "on",
  "to",
  "of",
  "in",
  "me",
  "you",
  "i",
  "am",
  "is",
  "are",
  "need",
  "looking",
  "find",
  "search",
  "buy",
  "want",
  "thanks",
  "thank",
  "thank you",
  "hello",
  "hi",
  "hey",
]);

const GENERIC_INTENT_WORDS = new Set([
  "something",
  "anything",
  "item",
  "items",
  "stuff",
  "thing",
  "things",
]);

const PRODUCT_VERBS = [
  "buy",
  "purchase",
  "find",
  "search",
  "show",
  "browse",
  "recommend",
  "need",
  "want",
  "looking for",
  "price",
  "compare",
  "options",
];

const MIN_RESULTS = 3;
const MAX_RESULTS = 5;

const tokenize = (text) =>
  (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

const detectPriceIntent = (tokens) => {
  const joined = tokens.join(" ");
  if (PRICE_KEYWORDS.cheap.some((w) => joined.includes(w))) return "cheap";
  if (PRICE_KEYWORDS.expensive.some((w) => joined.includes(w))) {
    return "expensive";
  }
  return "mid";
};

const detectCategory = (tokens) => {
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (tokens.some((t) => words.includes(t))) {
      return category;
    }
  }
  return null;
};

const mapListingPreview = (listing) => {
  const obj = listing.toObject ? listing.toObject() : listing;
  const images =
    Array.isArray(obj.images) && obj.images.length
      ? obj.images
      : obj.imageUrl
        ? [obj.imageUrl]
        : [];

  return {
    id: obj._id || listing._id,
    title: obj.title,
    price: obj.price,
    category: obj.category,
    condition: obj.condition,
    imageUrl: images[0],
    sellerName: obj.seller?.name,
    sellerEmail: obj.seller?.email,
    link: `${getFrontendBase()}/products/${obj._id || listing._id}`,
  };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const detectIntent = (message) => {
  const normalized = (message || "").toLowerCase();
  const tokens = tokenize(message);
  const keywords = tokens
    .filter((t) => !STOP_WORDS.has(t))
    .filter((t) => !GENERIC_INTENT_WORDS.has(t));
  const contentKeywords = keywords.filter((t) => !PRODUCT_VERBS.includes(t));

  if (GREETING_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return { intent: "general", reason: "greeting" };
  }

  if (ABOUT_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return { intent: "about" };
  }

  if (HELP_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return { intent: "help" };
  }

  const category = detectCategory(tokens);
  const priceIntent = detectPriceIntent(tokens);
  const hasPriceCue = priceIntent !== "mid";
  const hasProductVerb = PRODUCT_VERBS.some((kw) => normalized.includes(kw));
  const hasMeaningfulKeywords = contentKeywords.length > 0;

  const isProductIntent =
    category ||
    (hasProductVerb && hasMeaningfulKeywords) ||
    (hasPriceCue && hasMeaningfulKeywords);

  if (isProductIntent) {
    return {
      intent: "product",
      category,
      keywords: contentKeywords,
      priceIntent,
    };
  }

  if (hasProductVerb && !hasMeaningfulKeywords) {
    return { intent: "ambiguous" };
  }

  return keywords.length ? { intent: "general" } : { intent: "ambiguous" };
};

const searchProducts = async ({ category, keywords = [], limit = 60 }) => {
  const query = { status: "active" };

  if (category) {
    query.category = { $regex: new RegExp(escapeRegex(category), "i") };
  }

  const keywordRegexes = (keywords || [])
    .filter(Boolean)
    .map((kw) => new RegExp(escapeRegex(kw), "i"));

  if (keywordRegexes.length) {
    query.$or = keywordRegexes.flatMap((regex) => [
      { title: { $regex: regex } },
      { description: { $regex: regex } },
      { tags: { $regex: regex } },
    ]);
  }

  const products = await Listing.find(query)
    .populate("seller", "name email")
    .sort({ createdAt: -1 })
    .limit(limit);

  return products;
};

const fetchAndComputePrice = (items, priceIntent, limit = MAX_RESULTS) => {
  if (!items || !items.length) return { products: [], band: null };

  const sorted = [...items].sort((a, b) => Number(a.price) - Number(b.price));

  if (priceIntent === "cheap") {
    return { products: sorted.slice(0, limit), band: "cheap" };
  }

  if (priceIntent === "expensive") {
    return { products: sorted.slice(-limit).reverse(), band: "expensive" };
  }

  // Mid / neutral: take middle slice for variety
  const midStart = Math.max(0, Math.floor(sorted.length / 2) - limit + 1);
  return {
    products: sorted.slice(midStart, midStart + limit),
    band: "mid",
  };
};

const formatProductsForContext = (products) =>
  products
    .map((p) => {
      const summary = [p.title, p.description].filter(Boolean).join(" — ");
      const link = `${getFrontendBase()}/products/${p._id || p.id}`;
      return `${p.title || "Item"} - ${p.price} - ${summary} - ${link}`;
    })
    .join("\n");

const buildProductReply = (
  products,
  intent,
  { fallbackCategory = false } = {},
) => {
  if (!products?.length) {
    const label = intent.keywords?.[0] || intent.category || "items";
    return `I couldn't find ${label} right now.`;
  }

  const label = intent.keywords?.[0] || intent.category || "items";
  const header = fallbackCategory
    ? `I couldn't find exact ${label}, but here are close options in the same category:`
    : products.length < MIN_RESULTS
      ? `I only found ${products.length} ${label} at the moment:`
      : `Here are ${Math.min(products.length, MAX_RESULTS)} ${label} that fit your request:`;

  const lines = products.slice(0, MAX_RESULTS).map((p) => {
    const conditionNote = p.condition ? `, ${p.condition}` : "";
    return `- ${p.title} (${p.price}): ${p.category || ""}${conditionNote}`;
  });

  return [header, ...lines].join("\n");
};

const getRecentFallbackProducts = async (limit = 8) =>
  Listing.find({ status: "active" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("seller", "name email");

const generateAIResponse = async ({ context, userMessage }) => {
  const prompt = `You are UniBazzar Assistant, helping students buy/sell on campus. Be concise (<120 words), highlight relevance, and mention if items seem budget or premium based on listed prices. If options are limited, suggest close alternatives and remind users they can post their own listing.\n\nListings:\n${context || "(no context provided)"}\n\nUser request: ${userMessage}\nAssistant:`;

  return generateGeminiReply(prompt);
};

export const chatWithAssistant = async (req, res, next) => {
  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide a message." });
    }

    const trimmed = message.trim();
    const intent = detectIntent(trimmed);

    if (intent.intent === "product") {
      const primaryResults = await searchProducts({
        category: intent.category,
        keywords: intent.keywords,
      });

      const { products: filteredPrimary, band } = fetchAndComputePrice(
        primaryResults,
        intent.priceIntent,
        MAX_RESULTS,
      );

      let filtered = filteredPrimary;
      let usedCategoryFallback = false;

      if (!filtered.length && intent.category) {
        const categoryOnly = await searchProducts({
          category: intent.category,
        });
        const computed = fetchAndComputePrice(categoryOnly, intent.priceIntent);
        filtered = computed.products;
        usedCategoryFallback = Boolean(filtered.length);
      }

      const hasResults = filtered.length > 0;

      if (!hasResults) {
        const label = intent.keywords?.[0] || intent.category || "items";
        return res.json({
          type: "text",
          reply: `No ${intent.priceIntent === "expensive" ? "expensive " : intent.priceIntent === "cheap" ? "budget " : ""}${label} available right now. Try another category or price range.`,
        });
      }

      const mappedProducts = filtered
        .slice(0, MAX_RESULTS)
        .map(mapListingPreview);
      const context = formatProductsForContext(filtered);

      let aiReply = buildProductReply(mappedProducts, intent, {
        fallbackCategory: usedCategoryFallback,
      });
      try {
        const modelReply = await generateAIResponse({
          context,
          userMessage: trimmed,
        });
        aiReply = modelReply || aiReply;
      } catch (err) {
        console.error("[chatWithAssistant][ai]", err?.response?.data || err);
      }

      return res.json({
        type: "rag",
        reply: aiReply,
        products: mappedProducts,
        priceBand: band,
      });
    }

    if (intent.intent === "help") {
      return res.json({
        type: "text",
        reply:
          "To post a product:\n1) Go to your dashboard\n2) Click 'Add Listing'\n3) Upload images\n4) Set price, category, and description\n5) Add pickup or delivery note\n6) Submit. You can also browse, favorite items, and chat with sellers safely on campus.",
      });
    }

    if (intent.intent === "general" && intent.reason === "greeting") {
      return res.json({
        type: "text",
        reply:
          "Hello! I can help you find or sell items on UniBazzar. What are you looking for today?",
      });
    }

    if (intent.intent === "general") {
      return res.json({
        type: "text",
        reply:
          "I can help you search items by category or price, or guide you on selling. What do you need?",
      });
    }

    if (intent.intent === "about") {
      return res.json({
        type: "text",
        reply:
          "I’m the UniBazzar Assistant. I help students find items, compare prices, and post listings safely on campus. Ask for a product, a price range, or how to list your own item.",
      });
    }

    // Ambiguous or unclear intent
    return res.json({
      type: "text",
      reply:
        "What type of item are you looking for? e.g. laptop, clothes, phone. Add a price preference like cheap or expensive if you have one.",
    });
  } catch (error) {
    console.error("[chatWithAssistant]", error?.response?.data || error);

    if (error.message?.includes("GEMINI_API_KEY")) {
      return res.status(500).json({
        success: false,
        message: "AI assistant is not configured yet.",
      });
    }

    return res.status(502).json({
      success: false,
      message:
        error?.message ||
        "AI assistant is temporarily unavailable. Please try again soon.",
    });
  }
};
