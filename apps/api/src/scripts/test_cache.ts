import { getLatestBroadcast } from "../services/broadcast_cache";

async function testCache() {
  console.log("--- TEST 1: First Run (Should Generate) ---");
  const start1 = Date.now();
  const scenes1 = await getLatestBroadcast();
  const dur1 = Date.now() - start1;
  console.log(`Test 1 took ${dur1}ms. Scenes: ${scenes1?.length}`);

  console.log("\n--- TEST 2: Second Run (Should be Instant) ---");
  const start2 = Date.now();
  const scenes2 = await getLatestBroadcast();
  const dur2 = Date.now() - start2;
  console.log(`Test 2 took ${dur2}ms. Scenes: ${scenes2?.length}`);
  
  if (dur2 < 500) {
    console.log("\n✅ CACHE IS WORKING: Second run was near-instant!");
  } else {
    console.log("\n❌ CACHE FAILED: Second run is still slow!");
  }
}

testCache().then(() => process.exit(0)).catch(console.error);
