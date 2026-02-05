import { NextRequest, NextResponse } from "next/server";

const SERVER_URL = "https://x402-server-production.up.railway.app";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") || "/blockNumber";
  const xPayment = request.headers.get("x-payment");

  const headers: HeadersInit = {};
  if (xPayment) {
    headers["X-PAYMENT"] = xPayment;
  }

  try {
    const resp = await fetch(`${SERVER_URL}${path}`, { headers });
    const body = await resp.text();

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", resp.headers.get("Content-Type") || "application/json");

    // Forward the x-payment-response header if present
    const paymentResponse = resp.headers.get("x-payment-response");
    if (paymentResponse) {
      responseHeaders.set("x-payment-response", paymentResponse);
    }

    return new NextResponse(body, {
      status: resp.status,
      headers: responseHeaders,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Proxy error", details: String(e) },
      { status: 500 }
    );
  }
}
