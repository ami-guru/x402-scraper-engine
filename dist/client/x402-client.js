import { createWalletClient, createPublicClient, http, parseUnits, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
const DEFAULT_USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const DEFAULT_WORKER_URL = 'https://x402-scraper-engine.gejoe-tt.workers.dev';
const DEFAULT_RPC_URL = 'https://mainnet.base.org';
const ERC20_ABI = parseAbi([
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)'
]);
export class X402Client {
    workerUrl;
    rpcUrl;
    privateKey;
    constructor(config = {}) {
        this.workerUrl = (config.workerUrl || DEFAULT_WORKER_URL).replace(/\/$/, '');
        this.rpcUrl = config.rpcUrl || DEFAULT_RPC_URL;
        this.privateKey = config.privateKey;
    }
    async sendUsdcPayment(recipient, amountUsdc, tokenAddress = DEFAULT_USDC_BASE) {
        if (!this.privateKey) {
            throw new Error('HTTP 402: No privateKey configured on X402Client to sign Base USDC payment.');
        }
        const formattedKey = (this.privateKey.startsWith('0x') ? this.privateKey : `0x${this.privateKey}`);
        const account = privateKeyToAccount(formattedKey);
        const publicClient = createPublicClient({
            chain: base,
            transport: http(this.rpcUrl)
        });
        const walletClient = createWalletClient({
            account,
            chain: base,
            transport: http(this.rpcUrl)
        });
        const parsedAmount = parseUnits(amountUsdc, 6);
        const hash = await walletClient.writeContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [recipient, parsedAmount]
        });
        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        return hash;
    }
    async payAndExecute(endpoint, body) {
        const targetUrl = `${this.workerUrl}${endpoint}`;
        // Step 1: Probe request
        let res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            return (await res.json());
        }
        if (res.status === 402) {
            const paymentData = await res.json().catch(() => ({}));
            const recipient = res.headers.get('X-Payment-To') ||
                paymentData.payment?.recipient ||
                '0x4107f297256E00F32873f45F50A35a902c1c2034';
            const amount = res.headers.get('X-Payment-Amount') || paymentData.payment?.amount || '0.005';
            const tokenAddress = res.headers.get('X-Payment-Asset-Address') ||
                paymentData.payment?.contractAddress ||
                DEFAULT_USDC_BASE;
            // Step 2: Auto-settle on Base L2 USDC
            const txHash = await this.sendUsdcPayment(recipient, amount, tokenAddress);
            // Step 3: Resubmit with transaction receipt
            res = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Payment-Receipt': txHash
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(`Request failed after payment (${res.status}): ${errBody.message || JSON.stringify(errBody)}`);
            }
            return (await res.json());
        }
        const errText = await res.text();
        throw new Error(`Request failed (${res.status}): ${errText}`);
    }
    /**
     * Scrapes any public webpage and returns clean, sanitized Markdown (0.005 USDC)
     */
    async scrape(url) {
        return this.payAndExecute('/v1/scrape', { url });
    }
    /**
     * Synthesizes webpage content using Edge Llama 3 context compression (0.025 USDC)
     */
    async digest(url, focus) {
        return this.payAndExecute('/v1/digest', { url, focus });
    }
    /**
     * Performs real-time security, phishing, and smart contract audit on a domain (0.080 USDC)
     */
    async audit(url, contractAddress) {
        return this.payAndExecute('/v1/audit', { url, contract_address: contractAddress });
    }
    /**
     * Performs multi-source deep web search and synthesized research brief (0.050 USDC)
     */
    async search(query, limit = 3) {
        return this.payAndExecute('/v1/search', { query, limit });
    }
    /**
     * Searches real-time Twitter/X sentiment and cashtags ($BTC, $BASE) without the $100/mo API fee (0.050 USDC)
     */
    async searchTwitter(query, limit = 5) {
        return this.payAndExecute('/v1/twitter/search', { query, limit });
    }
    /**
     * Fetches public Twitter profile and recent tweets without the $100/mo API fee (0.030 USDC)
     */
    async getTwitterProfile(username) {
        return this.payAndExecute('/v1/twitter/profile', { username });
    }
}
