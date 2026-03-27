import { translateArticle, generateVernacularBriefing } from "../services/vernacular";
import { env } from "../env";

async function test() {
  console.log("Testing translation logic...");
  try {
    console.log("\n--- Testing Article Translation ---");
    const artResult = await translateArticle({
      lang: "hi",
      title: "Market Rally: Sensex jumps 1000 points",
      content: "The Indian stock market witnessed a massive surge today as the Sensex jumped over 1000 points. Investors were optimistic about the upcoming budget and stable global cues."
    });
    console.log("Article Translation Result:", JSON.stringify(artResult, null, 2));

    console.log("\n--- Testing Briefing Translation ---");
    const mockBriefing = {
      story_id: "test-story",
      headline: "Global Markets Stabilize",
      executive_summary: "Major indices across the globe showed signs of recovery as inflation data came in lower than expected.",
      sections: [
        { id: "sec1", title: "US Markets", content: "Wall Street closed higher on Tuesday.", citations: [] }
      ],
      suggested_questions: ["What happens next?", "Is this a bull trap?"]
    };

    const briefResult = await generateVernacularBriefing({
      storyId: "test-story",
      lang: "hi",
      englishBriefing: mockBriefing
    });
    console.log("Briefing Translation Result:", JSON.stringify(briefResult, null, 2));

  } catch (err) {
    console.error("Translation Failed:", err);
  }
}

test();
