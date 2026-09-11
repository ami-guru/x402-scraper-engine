import { createPublicClient, http, parseAbi, Address, formatUnits } from 'viem';
import { base } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config();

const TREASURY_WALLET: Address = '0x4107f297256E00F32873f45F50A35a902c1c2034';
const USDC_CONTRACT: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const WORKER_URL = 'https://x402-scraper-engine.gejoe-tt.workers.dev';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const BASE_RPC = 'https://mainnet.base.org';
const TREASURY = '0x4107f297256E00F32873f45F50A35a902c1c2034';

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
]);

async function rpcCall(method: string, params: any[]) {
  const res = await fetch(BASE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'x402-Broadcaster/1.3' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  return res.json();
}

async function main() {
  console.log('🚀 Executing Autonomous x402 Ecosystem Broadcaster...');

  // 1. Ping Edge Discovery & IndexNow
  try {
    const pingRes = await fetch(`${WORKER_URL}/v1/ping-index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'x402-Broadcaster/1.3' }
    });
    const pingData = await pingRes.json();
    console.log('✅ Discovery Broadcaster Result:', JSON.stringify(pingData, null, 2));
  } catch (err: any) {
    console.warn('⚠️ Discovery ping warning:', err.message);
  }

  // 2. Query Base L2 On-Chain Treasury State
  let usdcBal = 0;
  let ethBal = 0;
  try {
    const dataHex = '0x70a08231' + TREASURY.slice(2).toLowerCase().padStart(64, '0');
    const usdcRes: any = await rpcCall('eth_call', [{ to: USDC_CONTRACT, data: dataHex }, 'latest']);
    usdcBal = parseInt(usdcRes.result || '0x0', 16) / 1e6;

    const ethRes: any = await rpcCall('eth_getBalance', [TREASURY, 'latest']);
    ethBal = parseInt(ethRes.result || '0x0', 16) / 1e18;
    console.log(`💰 Base Treasury: ${usdcBal.toFixed(4)} USDC | ${ethBal.toFixed(6)} ETH`);
  } catch (err: any) {
    console.warn('⚠️ Base RPC query error:', err.message);
  }

  // 3. Write GitHub Actions Step Summary if in CI
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    const summary = `
### ⚡ x402 Engine Autonomous Distribution Broadcast

| Metric | Status |
| :--- | :--- |
| **Live API** | [${WORKER_URL}](${WORKER_URL}/health) |
| **Bazaar V2 Spec** | [/.well-known/x402.json](${WORKER_URL}/.well-known/x402.json) |
| **IndexNow Protocol** | Active (${WORKER_URL}/e9a7c3b2f1d048e58a7b9c6d3e2f1a0b.txt) |
| **Treasury Address** | \`${TREASURY}\` |
| **Base USDC Balance** | **$${usdcBal.toFixed(4)} USDC** |
| **Base ETH Balance** | **${ethBal.toFixed(6)} ETH** |
| **Timestamp** | ${new Date().toISOString()} |

Autonomous AI agent discovery broadcast dispatched to global search engines and Web3 indexing hubs.
`;
    fs.appendFileSync(summaryFile, summary);
  }
}

async function checkX402Metrics() {
  console.log('======================================================');
  console.log('⚡ x402 ENGINE LIVE STATUS & ON-CHAIN REVENUE REPORT');
  console.log('======================================================\n');

  // 1. Check On-Chain Base L2 Treasury Balance
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http('https://mainnet.base.org')
    });

    const [rawBalance, decimals, ethBalance] = await Promise.all([
      publicClient.readContract({
        address: USDC_CONTRACT,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [TREASURY_WALLET]
      }),
      publicClient.readContract({
        address: USDC_CONTRACT,
        abi: ERC20_ABI,
        functionName: 'decimals'
      }),
      publicClient.getBalance({ address: TREASURY_WALLET })
    ]);

    const usdcBalance = formatUnits(rawBalance, decimals);
    const ethFormatted = formatUnits(ethBalance, 18);

    console.log('💰 ON-CHAIN BASE L2 TREASURY WALLET:');
    console.log(`   Address:      ${TREASURY_WALLET}`);
    console.log(`   USDC Balance: ${usdcBalance} USDC`);
    console.log(`   ETH Balance:  ${ethFormatted} ETH`);
    console.log(`   BaseScan:     https://basescan.org/address/${TREASURY_WALLET}#tokentxns\n`);
  } catch (err: any) {
    console.error('❌ Failed reading Base L2 RPC:', err.message);
  }

  // 2. Check Cloudflare Worker Health
  try {
    const t0 = Date.now();
    const res = await fetch(`${WORKER_URL}/health`);
    const latency = Date.now() - t0;
    if (res.ok) {
      const data: any = await res.json();
      console.log('🌐 CLOUDFLARE GLOBAL EDGE ENGINE:');
      console.log(`   Status:       ${data.status} (v${data.version})`);
      console.log(`   Edge Latency: ${latency}ms`);
      console.log(`   Active Tiers: ${Object.keys(data.pricing || {}).length} endpoints live\n`);
    } else {
      console.log(`❌ Worker returned status ${res.status}`);
    }
  } catch (err: any) {
    console.error('❌ Failed pinging Worker:', err.message);
  }

  // 3. Check GitHub Repo & PR Status
  try {
    const headers: any = { 'User-Agent': 'x402-Status-Checker' };
    if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;

    const repoRes = await fetch('https://api.github.com/repos/ami-guru/x402-scraper-engine', { headers });
    if (repoRes.ok) {
      const repoData: any = await repoRes.json();
      console.log('🐙 GITHUB REPOSITORY METRICS:');
      console.log(`   Repo:         ${repoData.full_name}`);
      console.log(`   Stars:        ${repoData.stargazers_count}`);
      console.log(`   Forks:        ${repoData.forks_count}`);
      console.log(`   Open Issues:  ${repoData.open_issues_count}`);
      console.log(`   Default Br:   ${repoData.default_branch}`);
      console.log(`   Last Push:    ${repoData.pushed_at}\n`);
    }

    // Check upstream awesome-mcp-servers PR
    const prRes = await fetch('https://api.github.com/repos/punkpeye/awesome-mcp-servers/pulls?head=ami-guru:add-x402-scraper', { headers });
    if (prRes.ok) {
      const prs: any = await prRes.json();
      if (prs.length > 0) {
        console.log('📋 UPSTREAM AWESOME-MCP PR:');
        console.log(`   Title:  ${prs[0].title}`);
        console.log(`   State:  ${prs[0].state} (${prs[0].html_url})`);
        console.log(`   Merged: ${prs[0].merged_at ? 'YES ✅' : 'PENDING REVIEW ⏳'}\n`);
      }
    }
  } catch (err: any) {
    console.error('❌ Failed fetching GitHub data:', err.message);
  }

  console.log('======================================================\n');
}

checkX402Metrics();
