# Contributing to x402 Scraper Engine

Thank you for your interest in contributing to the **x402 Scraper Engine** project! We welcome community contributions from developers, Web3 engineers, and AI researchers.

---

## Code of Conduct

All contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure an inclusive, respectful environment for everyone.

---

## Development Setup

1. **Fork and Clone:**
   ```bash
   git clone https://github.com/ami-guru/x402-scraper-engine.git
   cd x402-scraper-engine
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Run Unit & Integration Mock Tests:**
   ```bash
   npm test
   ```

4. **Verify TypeScript Types:**
   ```bash
   npx tsc --noEmit
   ```

---

## Pull Request Guidelines

1. Ensure all 38+ mock unit & integration tests pass cleanly with `npm test`.
2. Do not introduce external DOM or Node-heavy dependencies into `src/` to preserve Cloudflare Workers V8 edge runtime compatibility.
3. Keep security filters (SSRF protection, KV anti-replay, receipt freshness checks) strictly enforced.
4. Provide clear PR descriptions explaining the rationale for any changes.
