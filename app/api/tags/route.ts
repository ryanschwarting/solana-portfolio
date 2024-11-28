import { NextResponse } from "next/server";

export const runtime = "edge";

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags: string[];
  // Add other fields as needed
}

interface TokenResponse {
  [mintAddress: string]: TokenInfo;
}

export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const tags = searchParams.get("tags") || "verified";

    const response = await fetch(`https://tokens.jup.ag/tokens?tags=${tags}`, {
      headers: {
        Referer: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        Origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      },
      next: {
        revalidate: 300, // Cache for 5 minutes
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429 }
        );
      }
      throw new Error(`Jupiter API returned ${response.status}`);
    }

    const data: TokenResponse = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch tokens" },
      { status: 500 }
    );
  }
}
