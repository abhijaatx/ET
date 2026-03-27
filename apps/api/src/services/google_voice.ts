export async function generateGoogleSpeech(text: string): Promise<ReadableStream> {
  // Unofficial Google Translate TTS has a 200 char limit
  const MAX_CHUNK_LEN = 200;
  
  // Split text into valid chunks (sentences or max length)
  const chunks: string[] = [];
  let currentPos = 0;
  
  while (currentPos < text.length) {
    let endPos = Math.min(currentPos + MAX_CHUNK_LEN, text.length);
    
    // Try to find a sentence boundary
    if (endPos < text.length) {
      const lastPunct = text.lastIndexOf(".", endPos);
      if (lastPunct > currentPos + 50) { // Only break if we have a reasonable chunk
        endPos = lastPunct + 1;
      } else {
        const lastSpace = text.lastIndexOf(" ", endPos);
        if (lastSpace > currentPos + 50) {
            endPos = lastSpace + 1;
        }
      }
    }
    
    chunks.push(text.substring(currentPos, endPos).trim());
    currentPos = endPos;
  }

  console.log(`[Google TTS] Splitting ${text.length} chars into ${chunks.length} chunks`);

  // Create a combined stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Sequential execution to preserve order
  const processChunks = async () => {
    try {
      for (const chunk of chunks) {
        if (!chunk) continue;
        
        const url = "https://translate.google.com/translate_tts?" + new URLSearchParams({
          ie: "UTF-8",
          q: chunk,
          tl: "en",
          client: "tw-ob"
        }).toString();

        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });

        if (!res.ok) {
          console.error(`[Google TTS] Failed chunk: ${res.status}`);
          continue;
        }

        const data = await res.arrayBuffer();
        await writer.write(new Uint8Array(data));
      }
    } catch (err) {
      console.error("[Google TTS] Stream error:", err);
    } finally {
      await writer.close();
    }
  };

  void processChunks();

  return readable;
}
