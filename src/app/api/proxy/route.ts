import { NextRequest, NextResponse } from "next/server";

const SERVER_URL = "https://x402-server-production.up.railway.app";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") || "/blockNumber";
  const paymentSig = request.headers.get("payment-signature");

  const headers: HeadersInit = {};
  if (paymentSig) {
    headers["PAYMENT-SIGNATURE"] = paymentSig;
  }

  try {
    const resp = await fetch(`${SERVER_URL}${path}`, { headers });
    const body = await resp.text();

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", resp.headers.get("Content-Type") || "application/json");

    // Forward the payment-response header if present
    const paymentResponse = resp.headers.get("payment-response");
    if (paymentResponse) {
      responseHeaders.set("payment-response", paymentResponse);
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
