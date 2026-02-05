"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  createWalletClient,
  custom,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  GATEWAY_URL,
  DEMO_PRIVATE_KEY,
  EXPLORER_URL,
  EIP712_DOMAIN,
  PAYMENT_AUTHORIZATION_TYPES,
  tempoModerato,
  type PaymentRequirements,
  type SignFn,
} from "@/lib/x402";

type WalletMode = "demo" | "injected";

interface Endpoint {
  slug: string;
  target_url: string;
  price: string;
  description?: string;
  created_at: number;
}

interface EndpointsResponse {
  endpoints: Endpoint[];
  count: number;
}

interface RegisterForm {
  slug: string;
  target_url: string;
  price: string;
  description: string;
}

function randomNonce(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex;
}

export default function GatewayPage() {
  const [mode, setMode] = useState<WalletMode>("demo");
  const [injectedAddress, setInjectedAddress] = useState<Address | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Register form state
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    slug: "",
    target_url: "",
    price: "$0.001",
    description: "",
  });
  const [registering, setRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<{
    success: boolean;
    message: string;
    txHash?: string;
  } | null>(null);

  // Test endpoint state
  const [testingSlug, setTestingSlug] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    slug: string;
    success: boolean;
    data?: any;
    txHash?: string;
    error?: string;
  } | null>(null);

  const demoAccount = privateKeyToAccount(DEMO_PRIVATE_KEY);
  const activeAddress = mode === "demo" ? demoAccount.address : injectedAddress;

  const connectInjected = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("No wallet detected. Install MetaMask or another EIP-1193 wallet.");
      return;
    }
    try {
      const [addr] = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      setInjectedAddress(addr as Address);
      setMode("injected");
    } catch (e) {
      console.error("Failed to connect wallet:", e);
    }
  }, []);

  const getSignFn = useCallback((): { signTypedData: SignFn; signerAddress: Address } | null => {
    if (mode === "demo") {
      const account = privateKeyToAccount(DEMO_PRIVATE_KEY);
      return {
        signerAddress: account.address,
        signTypedData: async (params) => account.signTypedData(params as any),
      };
    } else if (injectedAddress) {
      const client = createWalletClient({
        account: injectedAddress,
        chain: tempoModerato as any,
        transport: custom((window as any).ethereum),
      });
      return {
        signerAddress: injectedAddress,
        signTypedData: async (params) =>
          client.signTypedData({
            account: injectedAddress,
            ...params,
          } as any),
      };
    }
    return null;
  }, [mode, injectedAddress]);

  // Fetch endpoints
  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/endpoints`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: EndpointsResponse = await res.json();
      setEndpoints(data.endpoints);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  // Execute payment flow for gateway
  async function executeGatewayPayment(
    url: string,
    method: string,
    body?: object
  ): Promise<{ response: any; txHash?: string }> {
    const signer = getSignFn();
    if (!signer) throw new Error("No wallet connected");

    // First request - get 402
    const resp1 = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (resp1.status !== 402) {
      if (resp1.ok) {
        return { response: await resp1.json() };
      }
      throw new Error(`Unexpected status: ${resp1.status}`);
    }

    const paymentBody = await resp1.json();
    const requirements: PaymentRequirements = paymentBody.accepts?.[0];
    if (!requirements) {
      throw new Error("No payment requirements in 402 response");
    }

    // Sign payment
    const now = Math.floor(Date.now() / 1000);
    const validAfter = BigInt(now - 60);
    const validBefore = BigInt(now + requirements.maxTimeoutSeconds);
    const nonce = randomNonce();
    const value = BigInt(requirements.amount);

    const message = {
      from: signer.signerAddress,
      to: requirements.payTo,
      value,
      token: requirements.asset,
      validAfter,
      validBefore,
      nonce,
    };

    const signature = await signer.signTypedData({
      domain: EIP712_DOMAIN,
      types: PAYMENT_AUTHORIZATION_TYPES,
      primaryType: "PaymentAuthorization",
      message,
    });

    // Retry with payment
    const payload = {
      x402Version: paymentBody.x402Version,
      payload: {
        from: signer.signerAddress,
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

    const resp2 = await fetch(url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        "PAYMENT-SIGNATURE": encoded,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp2.ok) {
      const errText = await resp2.text();
      throw new Error(`Payment failed: ${errText}`);
    }

    const response = await resp2.json();
    let txHash: string | undefined;

    const settlementHeader = resp2.headers.get("payment-response");
    if (settlementHeader) {
      try {
        const settlement = JSON.parse(atob(settlementHeader));
        txHash = settlement.transaction;
      } catch {}
    }

    return { response, txHash };
  }

  // Register endpoint
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAddress) return;

    setRegistering(true);
    setRegisterResult(null);

    try {
      const { response, txHash } = await executeGatewayPayment(
        `${GATEWAY_URL}/register`,
        "POST",
        {
          slug: registerForm.slug,
          target_url: registerForm.target_url,
          price: registerForm.price,
          description: registerForm.description || undefined,
        }
      );

      setRegisterResult({
        success: true,
        message: `Endpoint "${registerForm.slug}" registered!`,
        txHash,
      });
      setRegisterForm({ slug: "", target_url: "", price: "$0.001", description: "" });
      fetchEndpoints();
    } catch (e) {
      setRegisterResult({
        success: false,
        message: e instanceof Error ? e.message : "Registration failed",
      });
    } finally {
      setRegistering(false);
    }
  };

  // Test endpoint
  const handleTestEndpoint = async (endpoint: Endpoint) => {
    if (!activeAddress) return;

    setTestingSlug(endpoint.slug);
    setTestResult(null);

    try {
      // Call the proxy endpoint - use a simple path
      const { response, txHash } = await executeGatewayPayment(
        `${GATEWAY_URL}/g/${endpoint.slug}/`,
        "GET"
      );

      setTestResult({
        slug: endpoint.slug,
        success: true,
        data: response,
        txHash,
      });
    } catch (e) {
      setTestResult({
        slug: endpoint.slug,
        success: false,
        error: e instanceof Error ? e.message : "Test failed",
      });
    } finally {
      setTestingSlug(null);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12 max-w-3xl mx-auto">
      <Link href="/" className="text-zinc-500 hover:text-white text-sm mb-8 self-start">
        ← Back to Demo
      </Link>

      <h1 className="text-3xl font-bold mb-2">x402 Gateway</h1>
      <p className="text-zinc-400 mb-8 text-center max-w-lg">
        A relay/proxy that adds payment rails to any HTTP API. Register your endpoint,
        set a price, and earn when others call it.
      </p>

      {/* Wallet selector */}
      <div className="w-full border border-zinc-800 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setMode("demo")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              mode === "demo"
                ? "bg-zinc-100 text-zinc-900"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Demo Key
          </button>
          <button
            onClick={injectedAddress ? () => setMode("injected") : connectInjected}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              mode === "injected"
                ? "bg-zinc-100 text-zinc-900"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {injectedAddress ? "Browser Wallet" : "Connect Wallet"}
          </button>
        </div>
        <div className="text-xs text-zinc-500 font-mono">
          {mode === "demo" ? (
            <>
              Using pre-funded testnet key:{" "}
              <span className="text-zinc-400">{demoAccount.address}</span>
            </>
          ) : injectedAddress ? (
            <>
              Connected: <span className="text-zinc-400">{injectedAddress}</span>
            </>
          ) : (
            "No wallet connected"
          )}
        </div>
      </div>

      {/* Register form */}
      <div className="w-full border border-zinc-800 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Register New Endpoint</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Slug</label>
              <input
                type="text"
                value={registerForm.slug}
                onChange={(e) => setRegisterForm({ ...registerForm, slug: e.target.value })}
                placeholder="my-api"
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                required
                minLength={3}
                maxLength={64}
                pattern="[a-zA-Z0-9-]+"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Price per request</label>
              <input
                type="text"
                value={registerForm.price}
                onChange={(e) => setRegisterForm({ ...registerForm, price: e.target.value })}
                placeholder="$0.001"
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Target URL (HTTPS)</label>
            <input
              type="url"
              value={registerForm.target_url}
              onChange={(e) => setRegisterForm({ ...registerForm, target_url: e.target.value })}
              placeholder="https://api.example.com"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Description (optional)</label>
            <input
              type="text"
              value={registerForm.description}
              onChange={(e) => setRegisterForm({ ...registerForm, description: e.target.value })}
              placeholder="My awesome API"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={registering || !activeAddress}
            className="w-full py-2.5 rounded font-semibold text-sm transition-colors disabled:opacity-40 bg-emerald-600 text-white hover:bg-emerald-500 disabled:hover:bg-emerald-600"
          >
            {registering ? "Registering..." : "Register Endpoint ($0.01 platform fee)"}
          </button>
        </form>

        {registerResult && (
          <div
            className={`mt-4 p-3 rounded text-sm ${
              registerResult.success
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}
          >
            <p>{registerResult.message}</p>
            {registerResult.txHash && (
              <a
                href={`${EXPLORER_URL}/tx/${registerResult.txHash}`}
                target="_blank"
                className="underline text-xs mt-1 block"
              >
                View transaction
              </a>
            )}
          </div>
        )}
      </div>

      {/* Registered Endpoints */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Registered Endpoints</h2>
          <button
            onClick={fetchEndpoints}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="border border-zinc-800 rounded-lg p-8 text-center text-zinc-500">
            Loading...
          </div>
        ) : error ? (
          <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-8 text-center text-red-400">
            {error}
          </div>
        ) : endpoints.length === 0 ? (
          <div className="border border-zinc-800 rounded-lg p-8 text-center text-zinc-500">
            No endpoints registered yet. Be the first!
          </div>
        ) : (
          <div className="space-y-3">
            {endpoints.map((ep) => (
              <div
                key={ep.slug}
                className="border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-emerald-400 font-mono text-sm">
                        /g/{ep.slug}/*
                      </code>
                      <span className="text-zinc-600">→</span>
                      <span className="text-zinc-400 text-sm truncate">
                        {ep.target_url}
                      </span>
                    </div>
                    {ep.description && (
                      <p className="text-zinc-500 text-sm">{ep.description}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center gap-3">
                    <div>
                      <div className="text-white font-medium">{ep.price}</div>
                      <div className="text-xs text-zinc-500">per request</div>
                    </div>
                    <button
                      onClick={() => handleTestEndpoint(ep)}
                      disabled={testingSlug === ep.slug || !activeAddress}
                      className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded text-xs font-medium hover:bg-zinc-700 disabled:opacity-40"
                    >
                      {testingSlug === ep.slug ? "Testing..." : "Test"}
                    </button>
                  </div>
                </div>

                {testResult && testResult.slug === ep.slug && (
                  <div
                    className={`mt-3 p-3 rounded text-xs ${
                      testResult.success
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : "bg-red-500/10 border border-red-500/30"
                    }`}
                  >
                    {testResult.success ? (
                      <>
                        <p className="text-emerald-400 mb-1">Request successful!</p>
                        <pre className="text-zinc-400 overflow-x-auto max-h-24 overflow-y-auto">
                          {JSON.stringify(testResult.data, null, 2)}
                        </pre>
                        {testResult.txHash && (
                          <a
                            href={`${EXPLORER_URL}/tx/${testResult.txHash}`}
                            target="_blank"
                            className="text-emerald-400 underline mt-2 block"
                          >
                            View payment tx
                          </a>
                        )}
                      </>
                    ) : (
                      <p className="text-red-400">{testResult.error}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Links */}
      <div className="mt-12 text-xs text-zinc-600 text-center space-y-1">
        <p>
          <Link href="/docs" className="underline hover:text-zinc-400">
            Documentation
          </Link>{" "}
          |{" "}
          <a
            href="https://crates.io/crates/tempo-x402-gateway"
            className="underline hover:text-zinc-400"
            target="_blank"
          >
            crates.io
          </a>{" "}
          |{" "}
          <a
            href="https://github.com/compusophy/tempo-x402"
            className="underline hover:text-zinc-400"
            target="_blank"
          >
            GitHub
          </a>
        </p>
        <p>Testnet only. Platform fee: $0.01 pathUSD.</p>
      </div>
    </main>
  );
}
