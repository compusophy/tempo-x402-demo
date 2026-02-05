import {
  type Hex,
  type Address,
  createPublicClient,
  http,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";

// Tempo Moderato chain definition
export const tempoModerato = {
  id: 42431,
  name: "Tempo Moderato",
  nativeCurrency: { name: "TEMPO", symbol: "TEMPO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.moderato.tempo.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Tempo Explorer",
      url: "https://explore.moderato.tempo.xyz",
    },
  },
} as const;

export const SCHEME_NAME = "tempo-tip20";
export const SERVER_URL = "https://x402-server-production.up.railway.app";
export const PROXY_URL = "/api/proxy";
export const EXPLORER_URL = "https://explore.moderato.tempo.xyz";

// Pre-funded demo key (testnet only)
export const DEMO_PRIVATE_KEY =
  "0x02e0f517cfcfbd207ebac4a000814e57834e33ef45437b30967bc7be13bba41b" as Hex;

// EIP-712 domain for payment authorization
export const EIP712_DOMAIN = {
  name: "x402-tempo",
  version: "1",
  chainId: 42431n,
  verifyingContract: "0x20c0000000000000000000000000000000000000" as Address,
} as const;

// EIP-712 types
export const PAYMENT_AUTHORIZATION_TYPES = {
  PaymentAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "token", type: "address" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export interface PaymentRequirements {
  scheme: string;
  network: string;
  price: string;
  asset: Address;
  amount: string;
  payTo: Address;
  maxTimeoutSeconds: number;
  description?: string;
  mimeType?: string;
}

export interface PaymentRequiredBody {
  x402Version: number;
  accepts: PaymentRequirements[];
  description?: string;
  mimeType?: string;
}

export interface SettleResponse {
  success: boolean;
  errorReason?: string;
  payer?: Address;
  transaction: string;
  network: string;
}

export interface StepResult {
  step: string;
  status: "pending" | "active" | "done" | "error";
  data?: unknown;
  error?: string;
}

// Generate a random 32-byte nonce
function randomNonce(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex;
}

export type SignFn = (params: {
  domain: typeof EIP712_DOMAIN;
  types: typeof PAYMENT_AUTHORIZATION_TYPES;
  primaryType: "PaymentAuthorization";
  message: Record<string, unknown>;
}) => Promise<Hex>;

/**
 * Execute the full x402 payment flow, calling onStep for each stage.
 */
export async function executePaymentFlow(
  endpoint: string,
  signTypedData: SignFn,
  signerAddress: Address,
  onStep: (steps: StepResult[]) => void
): Promise<void> {
  const steps: StepResult[] = [
    { step: "Request protected endpoint", status: "active" },
    { step: "Receive 402 + payment requirements", status: "pending" },
    { step: "Sign EIP-712 payment authorization", status: "pending" },
    { step: "Retry with X-PAYMENT header", status: "pending" },
    { step: "Receive paid response", status: "pending" },
  ];

  const update = (idx: number, s: Partial<StepResult>) => {
    steps[idx] = { ...steps[idx], ...s };
    onStep([...steps]);
  };

  onStep([...steps]);

  // Step 1: Request the endpoint (via proxy to avoid CORS)
  const proxyUrl = `${PROXY_URL}?path=${encodeURIComponent(endpoint)}`;
  const resp1 = await fetch(proxyUrl);

  if (resp1.status !== 402) {
    update(0, {
      status: "error",
      error: `Expected 402, got ${resp1.status}`,
    });
    return;
  }

  update(0, { status: "done", data: { status: 402, url: `${SERVER_URL}${endpoint}` } });

  // Step 2: Parse 402 response
  const body: PaymentRequiredBody = await resp1.json();
  const requirements = body.accepts.find((r) => r.scheme === SCHEME_NAME);
  if (!requirements) {
    update(1, {
      status: "error",
      error: `No ${SCHEME_NAME} scheme in response`,
    });
    return;
  }

  update(1, { status: "done", data: requirements });

  // Step 3: Sign EIP-712
  update(2, { status: "active" });

  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(now - 60);
  const validBefore = BigInt(now + requirements.maxTimeoutSeconds);
  const nonce = randomNonce();
  const value = BigInt(requirements.amount);

  const message = {
    from: signerAddress,
    to: requirements.payTo,
    value,
    token: requirements.asset,
    validAfter,
    validBefore,
    nonce,
  };

  let signature: Hex;
  try {
    signature = await signTypedData({
      domain: EIP712_DOMAIN,
      types: PAYMENT_AUTHORIZATION_TYPES,
      primaryType: "PaymentAuthorization",
      message,
    });
  } catch (e) {
    update(2, {
      status: "error",
      error: `Signing failed: ${e instanceof Error ? e.message : String(e)}`,
    });
    return;
  }

  update(2, { status: "done", data: { signer: signerAddress, nonce } });

  // Step 4: Retry with payment
  update(3, { status: "active" });

  const payload = {
    x402Version: body.x402Version,
    payload: {
      from: signerAddress,
      to: requirements.payTo,
      value: requirements.amount,
      token: requirements.asset,
      validAfter: Number(validAfter),
      validBefore: Number(validBefore),
      nonce,
      signature,
    },
  };

  const encoded = btoa(JSON.stringify(payload));

  const resp2 = await fetch(proxyUrl, {
    headers: { "X-PAYMENT": encoded },
  });

  update(3, {
    status: "done",
    data: { status: resp2.status, hasPayment: true },
  });

  // Step 5: Parse result
  update(4, { status: "active" });

  if (!resp2.ok) {
    const errText = await resp2.text();
    update(4, {
      status: "error",
      error: `Server returned ${resp2.status}: ${errText}`,
    });
    return;
  }

  const responseData = await resp2.json();
  const settlementHeader = resp2.headers.get("x-payment-response");
  let settlement: SettleResponse | null = null;
  if (settlementHeader) {
    try {
      settlement = JSON.parse(settlementHeader);
    } catch {}
  }

  update(4, { status: "done", data: { response: responseData, settlement } });
}
