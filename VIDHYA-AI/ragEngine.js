// Retrieval-Augmented Generation (RAG) Vector & Semantic Indexing Engine for VIDYA AI

const chunksStore = []; // In-memory vector chunk store

// P1-4: Stopwords to filter from query tokens and chunk tokens
const STOPWORDS = new Set([
  'the', 'is', 'a', 'an', 'of', 'and', 'to', 'in', 'it', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'or', 'that', 'this',
  'be', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
  'might', 'can', 'shall', 'not', 'no', 'but', 'if', 'so', 'what',
  'which', 'who', 'how', 'when', 'where', 'why', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'than', 'too', 'very', 'just', 'about'
]);

function chunkText(text, chunkSize = 300, overlap = 50) {
  if (!text) return [];
  // P1-3: Prevent infinite loop when overlap >= chunkSize
  if (overlap >= chunkSize) overlap = Math.floor(chunkSize / 5);
  const words = text.split(/\s+/);
  const chunks = [];
  const step = chunkSize - overlap;

  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + chunkSize);
    if (chunkWords.length > 0) {
      chunks.push(chunkWords.join(' '));
    }
  }
  return chunks;
}

// P1-4: userId is stored on every chunk; indexDocument replaces existing chunks for same docId
function indexDocument({ docId, title, content, type = 'note', subject = 'General', userId = null }) {
  // Remove existing chunks for this docId to prevent duplicates on re-index
  for (let i = chunksStore.length - 1; i >= 0; i--) {
    if (chunksStore[i].docId === docId) chunksStore.splice(i, 1);
  }

  const textChunks = chunkText(content);
  const indexedChunks = textChunks.map((chunk, idx) => ({
    id: `${docId}_c${idx}`,
    docId,
    title,
    type,
    subject,
    userId,
    text: chunk,
    // P1-4: Use a Set for chunk tokens, filter stopwords
    tokens: new Set(
      chunk.toLowerCase().split(/\W+/).filter(t => t && !STOPWORDS.has(t))
    )
  }));

  chunksStore.push(...indexedChunks);
  return { docId, totalChunks: indexedChunks.length };
}

// P1-4: Filter by userId; use Set-based token matching; filter stopwords from query
function searchRelevantChunks(query, topK = 3, userId = null) {
  if (!query) return [];
  const queryTokens = query.toLowerCase().split(/\W+/).filter(t => t && !STOPWORDS.has(t));

  // If all query tokens are stopwords, return nothing
  if (queryTokens.length === 0) return [];

  const candidates = userId != null
    ? chunksStore.filter(c => c.userId === userId)
    : chunksStore;

  const scored = candidates.map(chunk => {
    let score = 0;
    queryTokens.forEach(token => {
      if (chunk.tokens.has(token)) score += 1;
    });
    return { ...chunk, tokens: undefined, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter(c => c.score > 0).slice(0, topK);
}

function buildRAGContext(query, userId = null) {
  const matches = searchRelevantChunks(query, 3, userId);
  if (!matches.length) return { contextText: '', citations: [] };

  const contextText = matches.map(m => `[Source: ${m.title} (${m.type})]: ${m.text}`).join('\n\n');
  const citations = matches.map(m => ({ docId: m.docId, title: m.title, type: m.type }));

  return { contextText, citations };
}

// Expose internal store for testing only
function _getChunksStore() {
  return chunksStore;
}

module.exports = {
  chunkText,
  indexDocument,
  searchRelevantChunks,
  buildRAGContext,
  _getChunksStore
};
