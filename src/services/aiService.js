/**
 * aiService.js
 * ------------
 * Unified AI service layer for the chatbot worker.
 */

import Listing from "../models/Listing.model.js";
import { generateGeminiReply } from "./gemini.service.js";
import intents from "./intentDetector.js";

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
  if (!items?.length) return { products: [], band: null };
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

export const processMessage = async (message) => {
  const trimmed = (message || "").trim();
  if (!trimmed) throw new Error("Empty message");

  const intent = intents.detectIntent(trimmed);

  if (intent.intent === "tutoring") {
    return { type: "text", reply: intents.buildTutoringReply() };
  }
  if (intent.intent === "cafe") {
    return { type: "text", reply: intents.buildCafeReply() };
  }

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
      return { type: "text", reply: "I couldn't find matching items right now. Try browsing other categories or posting a 'Looking For' listing so sellers can reach out to you!" };
    }

    const mappedProducts = filtered.slice(0, MAX_RESULTS).map(mapListingPreview);
    const context = formatProductsForContext(filtered);
    let aiReply = intents.buildProductReply(mappedProducts);

    try {
      const prompt = intents.SYSTEM_PROMPT(context, trimmed);
      const modelReply = await generateGeminiReply(prompt);
      aiReply = modelReply || aiReply;
    } catch (err) {
      console.error("[aiService][gemini]", err?.response?.data || err.message);
    }

    return { type: "rag", reply: aiReply, products: mappedProducts, priceBand: band };
  }

  if (intent.intent === "help") {
    return { type: "help", reply: "To post a product:\n1) Go to your dashboard\n2) Click 'Add Listing'\n3) Upload images\n4) Set price, category, and description\n5) Add pickup or delivery note\n6) Submit." };
  }
  if (intent.intent === "greeting") {
    return { type: "text", reply: "Hello! I can help you find products, cafes, or tutoring services on UniBazzar. What are you looking for today?" };
  }
  if (intent.intent === "about") {
    return { type: "text", reply: "I'm the UniBazzar Assistant. I help students find items, check the cafe menu, and find tutors quickly!" };
  }

  return { type: "text", reply: "What type of item are you looking for? e.g. laptop, clothes, phone. Add a price preference like cheap or expensive if you have one." };
};

export default { processMessage };
