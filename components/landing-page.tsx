"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletIcon, PlusCircle, X } from "lucide-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

interface TokenBalance {
  mint: string;
  symbol: string;
  balance: number;
  name?: string;
  price?: number;
  value?: number;
  confidenceLevel?: string;
}

interface WalletBalances {
  [wallet: string]: {
    solBalance: number;
    tokens: TokenBalance[];
  };
}

interface TokenPrice {
  id: string;
  type: string;
  price: string;
  extraInfo?: {
    quotedPrice?: {
      buyPrice: string;
      sellPrice: string;
    };
    confidenceLevel?: string;
  };
}

interface TokenPrices {
  [mint: string]: TokenPrice;
}

export function LandingPage() {
  const [wallets, setWallets] = useState<string[]>([""]);
  const [balances, setBalances] = useState<WalletBalances>({});
  const [isLoading, setIsLoading] = useState(false);
  const [tokenPrices, setTokenPrices] = useState<TokenPrices>({});
  const [tokenMetadata, setTokenMetadata] = useState<{ [key: string]: any }>(
    {}
  );

  const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || "");

  useEffect(() => {
    fetch(
      "https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json"
    )
      .then((response) => response.json())
      .then((data) => {
        const metadata = data.tokens.reduce((acc: any, token: any) => {
          acc[token.address] = token;
          return acc;
        }, {});
        setTokenMetadata(metadata);
      });
  }, []);

  async function fetchSolanaTokenPrices(tokens: TokenBalance[]) {
    try {
      const url =
        "https://api.jup.ag/price/v2?ids=" +
        tokens.map((t) => t.mint).join(",") +
        "&showExtraInfo=true";

      console.log("Fetching prices from:", url);

      const response = await fetch(url);
      const data = await response.json();

      console.log("Price data received:", data);
      return data.data as TokenPrices;
    } catch (error) {
      console.error("Error fetching Jupiter prices:", error);
      return {};
    }
  }

  async function fetchTokenBalances() {
    setIsLoading(true);
    const newBalances: WalletBalances = {};

    try {
      for (const wallet of wallets) {
        if (!wallet) continue;

        const pubKey = new PublicKey(wallet);

        // Fetch SOL balance
        const solBalance = await connection.getBalance(pubKey);
        const solBalanceInSOL = solBalance / 10 ** 9; // Convert lamports to SOL

        // Fetch token balances (your existing code)
        const tokens = await connection.getParsedTokenAccountsByOwner(pubKey, {
          programId: TOKEN_PROGRAM_ID,
        });

        const walletTokens = tokens.value
          .map(
            (token) =>
              ({
                mint: token.account.data.parsed.info.mint,
                symbol:
                  tokenMetadata[token.account.data.parsed.info.mint]?.symbol ||
                  "Unknown",
                name:
                  tokenMetadata[token.account.data.parsed.info.mint]?.name ||
                  "Unknown Token",
                balance: Number(
                  token.account.data.parsed.info.tokenAmount.uiAmount
                ),
                price: undefined,
                value: undefined,
              } as TokenBalance)
          )
          .filter((token) => token.balance > 0);

        // Fetch prices including SOL
        const prices = await fetchSolanaTokenPrices([
          {
            mint: "So11111111111111111111111111111111111111112",
            symbol: "SOL",
            name: "Solana",
            balance: solBalanceInSOL,
            price: undefined,
            value: undefined,
          } as TokenBalance,
          ...walletTokens,
        ]);

        // Add prices to tokens
        walletTokens.forEach((token) => {
          if (prices[token.mint]) {
            token.price = Number(prices[token.mint].price);
            token.value = token.balance * token.price;
          }
        });

        newBalances[wallet] = {
          solBalance: solBalanceInSOL,
          tokens: walletTokens,
        };
      }
      setBalances(newBalances);
    } catch (error) {
      console.error("Error fetching balances:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-gray-50">
      <main className="container px-4">
        <div className="mx-auto max-w-2xl space-y-8">
          <div className="text-center">
            <WalletIcon className="mx-auto h-12 w-12 text-blue-600" />
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Sync Your Solana Wallets
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              View all your SPL token balances in one place
            </p>
          </div>

          <div className="space-y-4">
            {wallets.map((wallet, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Enter wallet address"
                  value={wallet}
                  onChange={(e) => {
                    const newWallets = [...wallets];
                    newWallets[index] = e.target.value;
                    setWallets(newWallets);
                  }}
                />
                {wallets.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setWallets(wallets.filter((_, i) => i !== index))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setWallets([...wallets, ""])}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Another Wallet
              </Button>

              <Button
                className="w-full"
                onClick={fetchTokenBalances}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "View Balances"}
              </Button>
            </div>
          </div>

          {Object.entries(balances).length > 0 && (
            <div className="rounded-lg border p-4 space-y-4">
              <h2 className="text-xl font-semibold">Token Balances</h2>
              {Object.entries(balances).map(
                ([wallet, { solBalance, tokens }]) => (
                  <div key={wallet} className="space-y-4">
                    <h3 className="text-sm text-gray-500">
                      Wallet: {wallet.slice(0, 4)}...{wallet.slice(-4)}
                    </h3>

                    {/* SOL Balance Card */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div className="rounded-md border p-2 space-y-1">
                        <div className="text-sm font-medium">
                          SOL
                          <span className="text-xs text-gray-400 ml-1">
                            (Native)
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Balance: {solBalance.toLocaleString()}
                        </div>
                        {tokenPrices?.[
                          "So11111111111111111111111111111111111111112"
                        ]?.price && (
                          <>
                            <div className="text-sm text-gray-500">
                              Price: $
                              {Number(
                                tokenPrices[
                                  "So11111111111111111111111111111111111111112"
                                ].price
                              ).toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-500">
                              Value: $
                              {(
                                solBalance *
                                Number(
                                  tokenPrices[
                                    "So11111111111111111111111111111111111111112"
                                  ].price
                                )
                              ).toFixed(2)}
                            </div>
                          </>
                        )}
                      </div>

                      {/* SPL Tokens */}
                      {tokens
                        .filter(
                          (token): token is TokenBalance & { price: number } =>
                            token.price !== undefined &&
                            token.balance * token.price >= 1
                        )
                        .map((token, i) => (
                          <div
                            key={i}
                            className="rounded-md border p-2 space-y-1"
                          >
                            <div className="text-sm font-medium">
                              {token.symbol}
                              <span className="text-xs text-gray-400 ml-1">
                                ({token.mint.slice(0, 4)}...
                                {token.mint.slice(-4)})
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              Balance: {token.balance.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-500">
                              Price: ${token.price.toFixed(4)}
                              {token.confidenceLevel && (
                                <span
                                  className={`ml-1 text-xs ${
                                    token.confidenceLevel === "high"
                                      ? "text-green-500"
                                      : token.confidenceLevel === "medium"
                                      ? "text-yellow-500"
                                      : "text-red-500"
                                  }`}
                                >
                                  ({token.confidenceLevel})
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              Value: ${(token.balance * token.price).toFixed(2)}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}