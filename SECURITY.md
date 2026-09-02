# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

---

## Security Architecture & Defenses

The **x402 Scraper Engine** implements multi-layered security controls:

1. **SSRF (Server-Side Request Forgery) Prevention:**
   - Blocks loopback addresses (`127.0.0.1`, `localhost`, `::1`).
   - Blocks private network subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
   - Blocks cloud metadata IP (`169.254.169.254`).
   - Restricts protocols strictly to `http:` and `https:`.

2. **Replay Attack Mitigation:**
   - Cloudflare KV stores every redeemed transaction hash (`PROCESSED_TXS`) with a 24-hour expiration TTL.
   - Any replayed hash is rejected with HTTP 400.

3. **Receipt Freshness Enforcement:**
   - Verifies on-chain block timestamp $\le 900\text{ seconds}$ (15 minutes).
   - Rejects stale transactions.

4. **Zero Custodial Keys on Server:**
   - Worker operates in a zero-knowledge posture with only the public treasury address.

---

## Reporting Vulnerabilities

If you discover a security vulnerability or potential exploit, please email **security@getguruautomations.com** instead of filing a public GitHub issue. We aim to acknowledge reports within 24 hours.
