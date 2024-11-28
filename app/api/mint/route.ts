import { NextResponse } from "next/server";

export const runtime = "edge";

interface TokenInfo {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags: string[];
  extensions?: {
    coingeckoId?: string;
    description?: string;
    discord?: string;
    twitter?: string;
    website?: string;
  };
  // Jupiter specific fields
  hasMarket?: boolean;
  dailyVolume?: number;
  freezeAuthority?: string;
  mintAuthority?: string;
}

export async function GET(request: Request) {
  try {
    // Get the mint address from the search params
    const { searchParams } = new URL(request.url);
    const mint = searchParams.get("mint");

    if (!mint) {
      return NextResponse.json(
        { error: "Mint address is required" },
        { status: 400 }
      );
    }

    // Fetch token info from Jupiter
    const response = await fetch(`https://tokens.jup.ag/token/${mint}`, {
      headers: {
        Referer: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        Origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      },
      next: {
        revalidate: 300, // Cache for 5 minutes
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Token not found" }, { status: 404 });
      }

      if (response.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429 }
        );
      }

      throw new Error(`Jupiter API returned ${response.status}`);
    }

    const data: TokenInfo = await response.json();

    // Format and return the response
    return NextResponse.json(
      {
        mint: data.address,
        name: data.name,
        symbol: data.symbol,
        decimals: data.decimals,
        logoURI: data.logoURI,
        tags: data.tags,
        hasMarket: data.hasMarket,
        dailyVolume: data.dailyVolume,
        freezeAuthority: data.freezeAuthority,
        mintAuthority: data.mintAuthority,
        socials: {
          website: data.extensions?.website,
          twitter: data.extensions?.twitter,
          discord: data.extensions?.discord,
        },
        coingeckoId: data.extensions?.coingeckoId,
        description: data.extensions?.description,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching token:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch token info",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Add rate limiting if needed
export const config = {
  api: {
    bodyParser: false,
  },
};
