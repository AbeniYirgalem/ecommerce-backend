/**
 * intentDetector.js
 * ─────────────────────────────────────────────────────────────────────────
 * Single source of truth for Chatbot intents and entity extraction.
 */

export const GREETING_KEYWORDS = ["hello", "hi", "hey", "hola", "yo", "sup", "good morning", "good afternoon"];
export const ABOUT_KEYWORDS = ["who are you", "what are you", "what can you do"];
export const HELP_KEYWORDS = ["how to sell", "how do i sell", "post item", "post product"];
export const TUTORING_KEYWORDS = ["tutor", "tutoring", "tutors", "teaching", "study help"];
export const CAFE_KEYWORDS = ["cafe", "café", "coffee", "food", "drink", "menu", "eat", "lunch"];

export const PRICE_KEYWORDS = {
  cheap: ["cheap", "budget", "affordable", "low"],
  expensive: ["expensive", "premium", "high-end", "luxury"],
};

export const CONDITION_KEYWORDS = {
  new: ["new", "brand new", "sealed", "unused"],
  used: ["used", "second hand", "refurbished", "old"],
};

export const CATEGORY_KEYWORDS = {
  Electronics: ["electronics", "laptop", "phone", "macbook", "iphone", "computer"],
  Textbooks: ["book", "textbook", "novel", "guide"],
  Clothes: ["clothes", "clothing", "hoodie", "jacket", "shirt", "shoes"],
  Stationery: ["stationery", "pen", "notebook", "calculator"],
  Dormitory: ["furniture", "chair", "table", "bed", "mattress"],
  Other: ["bike", "bicycle"],
};

const PRODUCT_VERBS = ["buy", "purchase", "find", "search", "show", "recommend", "need", "want"];
const STOP_WORDS = new Set(["the", "a", "an", "for", "and", "with", "about", "on", "to", "of", "in"]);

export const MOCK_TUTORS = [
  { name: "Alice T.", subject: "Data Structures & Algorithms", rate: 500 },
  { name: "Bob M.", subject: "Web Development", rate: 400 },
];

export const MOCK_CAFE_MENU = [
  { item: "Cappuccino", price: 50 },
  { item: "Veggie Sandwich", price: 100 },
  { item: "Fresh Juice", price: 70 },
];

export const tokenize = (text) => (text || "").toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);
export const escapeRegex = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const detectCondition = (tokens) => {
  const joined = tokens.join(" ");
  if (CONDITION_KEYWORDS.new.some((w) => joined.includes(w))) return "new";
  if (CONDITION_KEYWORDS.used.some((w) => joined.includes(w))) return "used";
  return null;
};

export const detectPriceIntent = (tokens) => {
  const joined = tokens.join(" ");
  if (PRICE_KEYWORDS.cheap.some((w) => joined.includes(w))) return "cheap";
  if (PRICE_KEYWORDS.expensive.some((w) => joined.includes(w))) return "expensive";
  return "mid";
};

export const detectCategory = (tokens) => {
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (tokens.some((t) => words.includes(t))) return cat;
  }
  return null;
};

export const detectIntent = (message) => {
  const normalized = (message || "").toLowerCase();
  const tokens = tokenize(message);
  const keywords = tokens.filter((t) => !STOP_WORDS.has(t));
  const contentKeywords = keywords.filter((t) => !PRODUCT_VERBS.includes(t));

  if (GREETING_KEYWORDS.some((kw) => normalized.includes(kw))) return { intent: "greeting" };
  if (ABOUT_KEYWORDS.some((kw) => normalized.includes(kw))) return { intent: "about" };
  if (HELP_KEYWORDS.some((kw) => normalized.includes(kw))) return { intent: "help" };
  if (CAFE_KEYWORDS.some((kw) => normalized.includes(kw))) return { intent: "cafe" };
  if (TUTORING_KEYWORDS.some((kw) => normalized.includes(kw))) return { intent: "tutoring" };

  const category = detectCategory(tokens);
  const priceIntent = detectPriceIntent(tokens);
  const condition = detectCondition(tokens);

  const isProductIntent = category || PRODUCT_VERBS.some((kw) => normalized.includes(kw)) || priceIntent !== "mid";

  if (isProductIntent) return { intent: "product", category, keywords: contentKeywords, priceIntent, condition };
  return { intent: "ambiguous" };
};

export const buildProductReply = (products) => {
  if (!products?.length) {
    return "I couldn't find matching items right now. Try browsing other categories or posting a 'Looking For' listing so sellers can reach out to you!";
  }
  return products.map((p) => {
    const img = p.imageUrl ? `![IMAGE](${p.imageUrl})  \n` : "";
    return `${img}${p.title}  \nPrice: ${Number(p.price).toLocaleString()} ETB  \n${p.category || 'Other'} • ${p.condition || 'new'}  \n[Link to product details](${p.link})`;
  }).join("\n\n---\n\n");
};

export const buildTutoringReply = () => {
  const list = MOCK_TUTORS.map((t) => `- ${t.name}, ${t.subject} – ${t.rate} ETB/hr`).join("\n");
  return `Yes! Here are some tutors available:\n${list}`;
};

export const buildCafeReply = () => {
  const list = MOCK_CAFE_MENU.map((c) => `- ${c.item} – ${c.price} ETB`).join("\n");
  return `Today's café menu:\n${list}`;
};

export const SYSTEM_PROMPT = (context, userMessage) => `You are a UniBazzar AI Agent. Your role is to help users find, buy, or sell items in the campus marketplace. Follow these rules strictly:

1. **Database First**: Always query the database for the user’s request. Never respond with a generic message if products exist.

2. **Price Handling**: 
   - If the user asks for "cheap", "cheapest", "affordable", or a similar term, return the lowest-priced items matching their query.
   - If the user asks for "expensive" or "highest price", return the highest-priced items matching their query.
   - Always use **ETB** as the currency when showing prices.

3. **Product Display**:
   - Include the product image.
   - Show the product name.
   - Show the product price in ETB.
   - Include category and condition (new/used).
   - Provide a clickable link to the product details page: \`/products/{product_id}\`.

4. **Multiple Categories**:
   - If the user asks about multiple things (e.g., laptops, tutoring, café), handle each separately and give relevant data for each.

5. **Fallback**:
   - Only use a fallback message if **no items exist** in the database for the query.
   - Suggest posting a "Looking For" listing or browsing related categories if nothing matches.

6. **Tone**: Friendly, helpful, and concise. Guide users to take actions on UniBazzar.

**Example response for product:**
![IMAGE](image_url_here)
HP Laptop 8GB RAM  
Price: 50,000 ETB  
Electronics • new  
[Link to product details](link_url_here)

Database Items:
${context || "(no products matched)"}

User request: ${userMessage}
Assistant:`;

export default {
  detectIntent, buildProductReply, buildTutoringReply, buildCafeReply, SYSTEM_PROMPT, escapeRegex
};
