"use client";

import { useState, useCallback } from "react";
import {
  createWalletClient,
  custom,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  executePaymentFlow,
  type StepResult,
  type SignFn,
  DEMO_PRIVATE_KEY,
  SERVER_URL,
  EXPLORER_URL,
  tempoModerato,
} from "@/lib/x402";

type WalletMode = "demo" | "injected";

export default function Home() {
  const [mode, setMode] = useState<WalletMode>("demo");
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);
  const [injectedAddress, setInjectedAddress] = useState<Address | null>(null);

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

  const run = useCallback(async () => {
    setRunning(true);
    setSteps([]);

    let signTypedData: SignFn;
    let signerAddress: Address;

    if (mode === "demo") {
      const account = privateKeyToAccount(DEMO_PRIVATE_KEY);
      signerAddress = account.address;
      signTypedData = async (params) => {
        return account.signTypedData(params as any);
      };
    } else {
      if (!injectedAddress) {
        setRunning(false);
        return;
      }
      signerAddress = injectedAddress;
      const client = createWalletClient({
        account: injectedAddress,
        chain: tempoModerato as any,
        transport: custom((window as any).ethereum),
      });
      signTypedData = async (params) => {
        return client.signTypedData({
          account: injectedAddress,
          ...params,
        } as any);
      };
    }

    try {
      await executePaymentFlow(
        "/blockNumber",
        signTypedData,
        signerAddress,
        setSteps
      );
    } catch (e) {
      console.error("Flow error:", e);
    } finally {
      setRunning(false);
    }
  }, [mode, injectedAddress]);

  const demoAccount = privateKeyToAccount(DEMO_PRIVATE_KEY);
  const activeAddress =
    mode === "demo" ? demoAccount.address : injectedAddress;

  const settlement = steps
    .find((s) => s.step === "Receive paid response")
    ?.data as any;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">tempo-x402 demo</h1>
      <p className="text-zinc-400 mb-8 text-center">
        HTTP 402 Payment Required on{" "}
        <a
          href="https://tempo.xyz"
          className="underline text-zinc-300 hover:text-white"
          target="_blank"
        >
          Tempo
        </a>
        . Pay-per-request API calls with EIP-712 signed payments.
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
            onClick={
              injectedAddress ? () => setMode("injected") : connectInjected
            }
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              mode === "injected"
                ? "bg-zinc-100 text-zinc-900"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {injectedAddress
              ? "Browser Wallet"
              : "Connect Wallet"}
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
              Connected:{" "}
              <span className="text-zinc-400">{injectedAddress}</span>
            </>
          ) : (
            "No wallet connected"
          )}
        </div>
      </div>

      {/* Action */}
      <button
        onClick={run}
        disabled={running || (!activeAddress)}
        className="w-full py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-40 bg-white text-zinc-900 hover:bg-zinc-200 disabled:hover:bg-white mb-8"
      >
        {running
          ? "Running..."
          : `GET ${SERVER_URL}/blockNumber`}
      </button>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="w-full space-y-3">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`border rounded-lg p-4 transition-colors ${
                s.status === "active"
                  ? "border-blue-500/50 bg-blue-500/5"
                  : s.status === "done"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : s.status === "error"
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-zinc-800"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">
                  {s.status === "active"
                    ? "\u25CB"
                    : s.status === "done"
                    ? "\u2713"
                    : s.status === "error"
                    ? "\u2717"
                    : "\u00B7"}
                </span>
                <span
                  className={`text-sm font-medium ${
                    s.status === "pending" ? "text-zinc-600" : ""
                  }`}
                >
                  {i + 1}. {s.step}
                </span>
              </div>

              {s.error && (
                <pre className="text-xs text-red-400 mt-2 overflow-x-auto">
                  {s.error}
                </pre>
              )}

              {s.status === "done" && s.data ? (
                <pre className="text-xs text-zinc-500 mt-2 overflow-x-auto max-h-32 overflow-y-auto">
                  {JSON.stringify(s.data, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Settlement link */}
      {settlement?.settlement?.transaction && (
        <a
          href={`${EXPLORER_URL}/tx/${settlement.settlement.transaction}`}
          target="_blank"
          className="mt-6 text-sm text-emerald-400 underline hover:text-emerald-300"
        >
          View transaction on Tempo Explorer
        </a>
      )}

      {/* Info */}
      <div className="mt-12 text-xs text-zinc-600 text-center space-y-1">
        <p>
          Powered by{" "}
          <a
            href="https://crates.io/crates/tempo-x402"
            className="underline hover:text-zinc-400"
            target="_blank"
          >
            tempo-x402
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
        <p>Testnet only. pathUSD on Tempo Moderato (Chain ID 42431).</p>
      </div>
    </main>
  );
}
