// food-api.js - Fetches calorie/nutrition info for a food item.
//
// Tries Open Food Facts first (public, no API key). Falls back to a small
// built-in curated list so the app still works offline or when the network
// is unavailable. The fallback is clearly marked via the "source" field.

const https = require('https');
const { URL } = require('url');

// Curated fallback database (values per 100g, rounded). Used when the
// network is unavailable or the item is not found online.
const FALLBACK_DB = {
  'banana': { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, serving: '1 medium (118g)' },
  'apple': { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, serving: '1 medium (182g)' },
  'orange': { calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1, serving: '1 medium (131g)' },
  'egg': { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.0, serving: '1 large (50g)' },
  'rice': { calories: 130, protein: 2.7, carbs: 28.0, fat: 0.3, serving: '1 cup cooked (195g)' },
  'chicken breast': { calories: 165, protein: 31.0, carbs: 0.0, fat: 3.6, serving: '100g' },
  'bread': { calories: 265, protein: 9.0, carbs: 49.0, fat: 3.2, serving: '1 slice (46g)' },
  'pasta': { calories: 131, protein: 5.0, carbs: 25.0, fat: 1.1, serving: '1 cup cooked (140g)' },
  'milk': { calories: 42, protein: 3.4, carbs: 5.0, fat: 1.0, serving: '1 cup (244g)' },
  'yogurt': { calories: 59, protein: 10.0, carbs: 3.6, fat: 0.4, serving: '1 cup (227g)' },
  'oatmeal': { calories: 68, protein: 2.4, carbs: 12.0, fat: 1.4, serving: '1/2 cup dry (40g)' },
  'potato': { calories: 77, protein: 2.0, carbs: 17.0, fat: 0.1, serving: '1 medium (150g)' },
  'salmon': { calories: 208, protein: 20.0, carbs: 0.0, fat: 13.0, serving: '100g' },
  'almonds': { calories: 576, protein: 21.2, carbs: 21.7, fat: 49.9, serving: '1 oz (28g)' },
  'peanut butter': { calories: 588, protein: 24.8, carbs: 19.6, fat: 49.2, serving: '2 tbsp (32g)' },
  'coffee': { calories: 2, protein: 0.3, carbs: 0.4, fat: 0.0, serving: '1 cup (240ml)' },
  'tea': { calories: 1, protein: 0.0, carbs: 0.3, fat: 0.0, serving: '1 cup (240ml)' },
  'water': { calories: 0, protein: 0.0, carbs: 0.0, fat: 0.0, serving: '1 cup (240ml)' },
};

function findFallback(query) {
  const q = query.toLowerCase().trim();
  if (FALLBACK_DB[q]) return { ...FALLBACK_DB[q], source: 'curated-fallback' };
  // Substring match for compound names like "chicken breast sandwich".
  for (const [key, val] of Object.entries(FALLBACK_DB)) {
    if (q.includes(key) || key.includes(q)) {
      return { ...val, source: 'curated-fallback' };
    }
  }
  return null;
}

function fetchFromOpenFoodFacts(query) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://world.openfoodfacts.org/cgi-search.pl');
    url.searchParams.set('search_terms', query);
    url.searchParams.set('json', '1');
    url.searchParams.set('page_size', '5');
    url.searchParams.set('search_simple', '1');

    const req = https.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const products = (data && data.products) || [];
          const usable = products.find(
            (p) => p.nutriments && (p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal'])
          );
          if (!usable) return resolve(null);
          const n = usable.nutriments;
          resolve({
            food_name: usable.product_name || query,
            calories: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
            protein: n.protein_100g || 0,
            carbs: n.carbohydrates_100g || 0,
            fat: n.fat_100g || 0,
            serving: '100g',
            source: 'open-food-facts',
            code: usable.code,
          });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function lookupFood(query) {
  // Try the network first; fall back to the local curated list on any error.
  try {
    const result = await fetchFromOpenFoodFacts(query);
    if (result) return result;
  } catch (e) {
    // Network error or timeout - fall through.
  }
  return findFallback(query);
}

module.exports = { lookupFood, findFallback };