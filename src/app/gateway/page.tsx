"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GATEWAY_URL } from "@/lib/x402";

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

export default function GatewayPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEndpoints() {
      try {
        const res = await fetch(`${GATEWAY_URL}/endpoints`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: EndpointsResponse = await res.json();
        setEndpoints(data.endpoints);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch");
      } finally {
        setLoading(false);
      }
    }
    fetchEndpoints();
  }, []);

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

      {/* How it works */}
      <div className="w-full border border-zinc-800 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">How it works</h2>
        <ol className="space-y-3 text-sm text-zinc-400">
          <li className="flex gap-3">
            <span className="text-zinc-500 font-mono">1.</span>
            <span><strong className="text-zinc-200">Register</strong> - Pay a small platform fee to register your API endpoint</span>
          </li>
          <li className="flex gap-3">
            <span className="text-zinc-500 font-mono">2.</span>
            <span><strong className="text-zinc-200">Set price</strong> - Choose how much callers pay per request</span>
          </li>
          <li className="flex gap-3">
            <span className="text-zinc-500 font-mono">3.</span>
            <span><strong className="text-zinc-200">Earn</strong> - Receive payments directly when your endpoint is called</span>
          </li>
        </ol>
      </div>

      {/* Endpoints */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Registered Endpoints</h2>
          <span className="text-xs text-zinc-500 font-mono">
            {GATEWAY_URL}
          </span>
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
            No endpoints registered yet.
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
                  <div className="text-right flex-shrink-0">
                    <div className="text-white font-medium">{ep.price}</div>
                    <div className="text-xs text-zinc-500">per request</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Reference */}
      <div className="w-full mt-12 border-t border-zinc-800 pt-8">
        <h2 className="text-lg font-semibold mb-4">API Reference</h2>
        <div className="space-y-4 text-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                POST
              </span>
              <code className="text-zinc-300">/register</code>
              <span className="text-zinc-500 text-xs ml-auto">requires payment</span>
            </div>
            <p className="text-zinc-500">Register a new endpoint</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                GET
              </span>
              <code className="text-zinc-300">/endpoints</code>
              <span className="text-zinc-500 text-xs ml-auto">free</span>
            </div>
            <p className="text-zinc-500">List all registered endpoints</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                ANY
              </span>
              <code className="text-zinc-300">/g/:slug/*</code>
              <span className="text-zinc-500 text-xs ml-auto">requires payment</span>
            </div>
            <p className="text-zinc-500">Proxy request to registered endpoint</p>
          </div>
        </div>
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
      </div>
    </main>
  );
}
