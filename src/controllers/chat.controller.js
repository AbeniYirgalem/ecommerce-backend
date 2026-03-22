import Listing from "../models/Listing.model.js";
import { generateGeminiReply } from "../services/gemini.service.js";
import intents from "../services/intentDetector.js";
import { addChatJob, chatQueue } from "../queue/chatQueue.js";
import ChatLog from "../models/ChatLog.model.js";

const getFrontendBase = () => {
  const raw = process.env.CLIENT_URL || "http://localhost:5173";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

const MIN_RESULTS = 3;
const MAX_RESULTS = 5;

const searchProducts = async ({ category, keywords = [], limit = 60 }) => {
  const query = { status: "active" };
  if (category) query.category = { $regex: new RegExp(intents.escapeRegex(category), "i") };

  const keywordRegexes = (keywords || [])
    .filter(Boolean)
    .map((kw) => new RegExp(intents.escapeRegex(kw), "i"));

  if (keywordRegexes.length) {
    query.$or = keywordRegexes.flatMap((regex) => [
      { title: { $regex: regex } },
      { description: { $regex: regex } },
      { tags: { $regex: regex } },
    ]);
  }

  return Listing.find(query)
    .populate("seller", "name email")
    .sort({ createdAt: -1 })
    .limit(limit);
};

const mapListingPreview = (listing) => {
  const obj = listing.toObject ? listing.toObject() : listing;
  const images = Array.isArray(obj.images) && obj.images.length ? obj.images : obj.imageUrl ? [obj.imageUrl] : [];
  return {
    id: obj._id || listing._id,
    title: obj.title,
    price: obj.price,
    category: obj.category,
    condition: obj.condition,
    imageUrl: images[0],
    sellerName: obj.seller?.name,
    sellerEmail: obj.seller?.email,
    link: `/products/${obj._id || listing._id}`,
  };
};

const fetchAndComputePrice = (items, priceIntent, limit = MAX_RESULTS) => {
  if (!items || !items.length) return { products: [], band: null };
  const sorted = [...items].sort((a, b) => Number(a.price) - Number(b.price));
  if (priceIntent === "cheap") return { products: sorted.slice(0, limit), band: "cheap" };
  if (priceIntent === "expensive") return { products: sorted.slice(-limit).reverse(), band: "expensive" };
  const midStart = Math.max(0, Math.floor(sorted.length / 2) - limit + 1);
  return { products: sorted.slice(midStart, midStart + limit), band: "mid" };
};

const formatProductsForContext = (products) =>
  products.map((p) => {
    const summary = [p.title, p.description].filter(Boolean).join(" — ");
    const link = `/products/${p._id || p.id}`;
    return `${p.title || "Item"} - ${p.price} ETB - ${summary} - ${link}`;
  }).join("\n");

const generateAIResponse = async ({ context, userMessage }) => {
  const prompt = intents.SYSTEM_PROMPT(context, userMessage);
  return generateGeminiReply(prompt);
};

export const chatWithAssistant = async (req, res, next) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "Please provide a message." });
    }

    const trimmed = message.trim();
    const intent = intents.detectIntent(trimmed);

    if (intent.intent === "tutoring") return res.json({ type: "text", reply: intents.buildTutoringReply() });
    if (intent.intent === "cafe") return res.json({ type: "text", reply: intents.buildCafeReply() });

    if (intent.intent === "product") {
      const primaryResults = await searchProducts({ category: intent.category, keywords: intent.keywords });
      const { products: filteredPrimary, band } = fetchAndComputePrice(primaryResults, intent.priceIntent, MAX_RESULTS);

      let filtered = filteredPrimary;
      if (!filtered.length && intent.category) {
        const categoryOnly = await searchProducts({ category: intent.category });
        const computed = fetchAndComputePrice(categoryOnly, intent.priceIntent);
        filtered = computed.products;
      }

      if (!filtered.length) {
        return res.json({ type: "text", reply: "I couldn't find matching items right now. Try browsing other categories or posting a 'Looking For' listing so sellers can reach out to you!" });
      }

      const mappedProducts = filtered.slice(0, MAX_RESULTS).map(mapListingPreview);
      const context = formatProductsForContext(filtered);
      let aiReply = intents.buildProductReply(mappedProducts);

      try {
        const modelReply = await generateAIResponse({ context, userMessage: trimmed });
        aiReply = modelReply || aiReply;
      } catch (err) {
        console.error("[chatWithAssistant][ai]", err?.response?.data || err);
      }

      return res.json({ type: "rag", reply: aiReply, products: mappedProducts, priceBand: band });
    }

    if (intent.intent === "help") return res.json({ type: "text", reply: "To post a product:\n1) Go to your dashboard\n2) Click 'Add Listing'\n3) Upload images\n4) Set price, category, and description\n5) Add pickup or delivery note\n6) Submit." });
    if (intent.intent === "greeting") return res.json({ type: "text", reply: "Hello! I can help you find products, cafes, or tutoring services on UniBazzar. What are you looking for today?" });
    if (intent.intent === "about") return res.json({ type: "text", reply: "I'm the UniBazzar Assistant. I help students find items, check the cafe menu, and find tutors quickly!" });

    return res.json({ type: "text", reply: "What type of item are you looking for? e.g. laptop, clothes, phone. Add a price preference like cheap or expensive if you have one." });
  } catch (error) {
    console.error("[chatWithAssistant]", error?.response?.data || error);
    if (error.message?.includes("GEMINI_API_KEY")) return res.status(500).json({ success: false, message: "AI assistant is not configured yet." });
    return res.status(502).json({ success: false, message: error?.message || "AI assistant is temporarily unavailable. Please try again soon." });
  }
};

export const addChatJobController = async (req, res, next) => {
  try {
    const { message, userId, priority = 5 } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message is required." });
    }
    const job = await addChatJob(message.trim(), userId || "anonymous", priority);
    return res.status(202).json({ success: true, message: "Chat request added to queue.", jobId: job.id });
  } catch (error) {
    console.error("[chatController] Error adding job to queue:", error);
    next(error);
  }
};

export const getJobStatusController = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await chatQueue.getJob(jobId);
    if (job) {
      const state = await job.getState();
      const progress = job.progress;
      let result = job.returnvalue;
      if (!result && state === "completed") {
        const chatLog = await ChatLog.findOne({ jobId });
        result = chatLog?.reply ? { type: chatLog.status === "completed" ? "rag" : "text", reply: chatLog.reply, products: chatLog.products || [] } : null;
      }
      return res.json({ success: true, jobId, status: state, progress, result, error: job.failedReason, attemptsMade: job.attemptsMade });
    }
    const chatLog = await ChatLog.findOne({ jobId });
    if (!chatLog) return res.status(404).json({ success: false, message: "Job not found." });
    return res.json({ success: true, jobId, status: chatLog.status, result: chatLog.status === "completed" ? { type: "rag", reply: chatLog.reply, products: chatLog.products || [] } : null, error: chatLog.error, attemptsMade: chatLog.attemptsMade });
  } catch (error) {
    console.error("[chatController] Error fetching job status:", error);
    next(error);
  }
};
