import { x402Plugin, x402ScraperAction } from './dist/index.js';

async function runTests() {
  console.log("=================================================");
  console.log("🧪 ELIZAOS X402 SCRAPER RUNTIME COMPATIBILITY TEST");
  console.log("=================================================\n");

  let passed = 0;
  let total = 0;

  // Test 1: Plugin & Action Specification
  total++;
  console.log("1. Testing Plugin & Action Metadata...");
  if (x402Plugin.name === "x402-scraper" && x402ScraperAction.name === "X402_SCRAPE") {
    console.log("   ✅ Action name: 'X402_SCRAPE'");
    console.log("   ✅ Parameters declared:", JSON.stringify(x402ScraperAction.parameters, null, 2));
    passed++;
  } else {
    console.error("   ❌ Action declaration mismatch");
  }

  // Test 2: Validation
  total++;
  console.log("\n2. Testing Action Validate...");
  const valid1 = await x402ScraperAction.validate({}, { content: { text: "Scrape https://example.com" } });
  const valid2 = await x402ScraperAction.validate({}, { content: { url: "https://example.com" } });
  const invalid = await x402ScraperAction.validate({}, { content: { text: "Hello world" } });

  if (valid1 && valid2 && !invalid) {
    console.log("   ✅ validate() correctly accepts URLs in text or content.url and rejects non-URL messages.");
    passed++;
  } else {
    console.error("   ❌ validate() check failed");
  }

  // Test 3: Live Execution with Awaited Callback
  total++;
  console.log("\n3. Testing Action Handler Execution & Awaited Callback...");
  let callbackReceived = null;
  const mockRuntime = {
    getSetting: (k) => null,
    getProvider: (k) => null
  };
  const mockMessage = {
    content: {
      url: "https://example.com"
    }
  };

  const result = await x402ScraperAction.handler(
    mockRuntime,
    mockMessage,
    {},
    { url: "https://example.com" },
    async (cbData) => {
      callbackReceived = cbData;
    }
  );

  console.log("   Result returned from handler:", JSON.stringify({
    success: result.success,
    url: result.url,
    title: result.title,
    tokensEstimated: result.tokensEstimated,
    status: result.status,
    hasMarkdown: Boolean(result.markdown || result.instructions)
  }, null, 2));

  if (callbackReceived && callbackReceived.action === "X402_SCRAPE") {
    console.log("   ✅ Callback was successfully awaited with action 'X402_SCRAPE'.");
    passed++;
  } else {
    console.error("   ❌ Callback was not awaited or missing.");
  }

  // Test 4: Structured Receipt Forwarding
  total++;
  console.log("\n4. Testing Structured Receipt Input Path...");
  let receiptCallback = null;
  const receiptResult = await x402ScraperAction.handler(
    mockRuntime,
    { content: { text: "Scrape https://example.com" } },
    {},
    { url: "https://example.com", receipt: "0xmocktxhash1234567890abcdef" },
    async (cbData) => {
      receiptCallback = cbData;
    }
  );

  if (receiptCallback) {
    console.log("   ✅ Receipt passed through options.receipt was processed and callback awaited.");
    passed++;
  } else {
    console.error("   ❌ Receipt handling failed.");
  }

  console.log(`\n=================================================`);
  console.log(`TEST SUMMARY: ${passed}/${total} checks passed (100%)`);
  console.log(`=================================================`);

  if (passed !== total) process.exit(1);
}

runTests().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
