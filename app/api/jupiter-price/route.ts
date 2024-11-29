import { NextResponse } from "next/server";

export const runtime = "edge";

interface TokenPrice {
  id: string;
  type: string;
  price: string;
  extraInfo?: {
    quotedPrice?: {
      buyPrice: string;
      sellPrice: string;
      buyAt: number;
      sellAt: number;
    };
    confidenceLevel?: string;
    lastSwappedPrice?: {
      lastJupiterSellPrice: string;
      lastJupiterBuyPrice: string;
      lastJupiterSellAt: number;
      lastJupiterBuyAt: number;
    };
  };
  priceChange?: {
    "24h": number;
  };
}

interface PriceResponse {
  data: {
    [mint: string]: TokenPrice;
  };
  timeTaken: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get("ids");

    if (!ids) {
      return NextResponse.json(
        { error: "Token IDs are required" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.jup.ag/price/v2?ids=${ids}&showExtraInfo=true&includeHistory=true`,
      {
        headers: {
          Referer: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          Origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        },
        next: {
          revalidate: 10, // Cache for 10 seconds since prices change frequently
        },
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429 }
        );
      }
      throw new Error(`Jupiter API returned ${response.status}`);
    }

    const data: PriceResponse = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("Error fetching prices:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch prices",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
