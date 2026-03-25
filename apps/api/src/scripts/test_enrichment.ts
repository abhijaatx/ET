import { refreshGlobalBroadcast } from "../services/broadcast_cache";

async function testEnrichment() {
  console.log("--- TRIGGERING ENRICHED BROADCAST GENERATION ---");
  const start = Date.now();
  const scenes = await refreshGlobalBroadcast();
  const dur = Date.now() - start;
  
  if (scenes && scenes.length > 0) {
    console.log(`\n✅ GENERATION SUCCESSFUL (${dur}ms)`);
    console.log(`Total Scenes: ${scenes.length}`);
    console.log("\n--- PREVIEW OF FIRST SCENE ---");
    console.log(`Title: ${scenes[0].overlayTitle}`);
    console.log(`Narration: ${scenes[0].narration.substring(0, 200)}...`);
    console.log(`Bullets: ${scenes[0].overlayBullets.join(", ")}`);
    console.log(`Image: ${scenes[0].imageUrl}`);
  } else {
    console.log("\n❌ GENERATION FAILED or NO SCENES");
  }
}

testEnrichment().then(() => process.exit(0)).catch(console.error);
