"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletIcon, PlusCircle, X, Loader2, Copy, Check } from "lucide-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TokenCard } from "@/components/token-card";
import {
  fetchTokenBalances,
  calculatePortfolioTotals,
  type WalletBalances,
  type TokenPrices,
} from "@/utils/portfolio-utils";

export function LandingPage() {
  const [wallets, setWallets] = useState<string[]>([""]);
  const [balances, setBalances] = useState<WalletBalances>({});
  const [isLoading, setIsLoading] = useState(false);
  const [tokenPrices, setTokenPrices] = useState<TokenPrices>({});
  const [verifiedTokens, setVerifiedTokens] = useState<{ [key: string]: any }>(
    {}
  );
  const [isCopied, setIsCopied] = useState<string>("");
  const [hasLoadedData, setHasLoadedData] = useState(false);

  const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || "");

  useEffect(() => {
    fetch("/api/tags?tags=verified")
      .then((response) => response.json())
      .then((data) => {
        setVerifiedTokens(data);
      })
      .catch((error) =>
        console.error("Error fetching verified tokens:", error)
      );
  }, []);

  async function handleFetchTokenBalances() {
    setIsLoading(true);
    await fetchTokenBalances(
      wallets,
      connection,
      setTokenPrices,
      setBalances,
      setHasLoadedData
    );
    setIsLoading(false);
  }

  function resetView() {
    setHasLoadedData(false);
    setBalances({});
    setWallets([""]);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="container mx-auto px-4 py-8">
        <Card className="bg-zinc-950 border-none shadow-none">
          <CardHeader>
            <div className="flex items-center justify-center space-x-4">
              <WalletIcon className="h-10 w-10 text-phantom" />
              <div>
                <CardTitle className="text-3xl font-bold text-white">
                  Solana Portfolio Tracker
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Sync and view all your SPL token balances in one place
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!hasLoadedData ? (
              <div className="space-y-4">
                {wallets.map((wallet, index) => (
                  <div key={index} className="flex gap-2 relative group">
                    <Input
                      placeholder="Enter Solana wallet address"
                      value={wallet}
                      onChange={(e) => {
                        const newWallets = [...wallets];
                        newWallets[index] = e.target.value;
                        setWallets(newWallets);
                      }}
                      className="bg-gray-800/30 border-gray-700/50 text-white placeholder:text-gray-500 h-12 px-4 rounded-xl
                        focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-800/50 transition-all duration-200"
                    />
                    {wallets.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setWallets(wallets.filter((_, i) => i !== index))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-400 
                          hover:bg-transparent transition-colors duration-200"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setWallets([...wallets, ""])}
                    className="flex-1 h-12 bg-gray-800/30 border-gray-700/50 text-gray-300 
                      hover:bg-gray-800/50 hover:text-white transition-all duration-200 rounded-xl"
                  >
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Add Wallet
                  </Button>

                  <Button
                    onClick={handleFetchTokenBalances}
                    disabled={isLoading}
                    className="flex-1 h-12 bg-phantom hover:bg-phantom/90 text-charchoal font-medium
                      transition-all duration-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        <span>Loading...</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <WalletIcon className="mr-2 h-5 w-5" />
                        <span>View Balances</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold bg-charchoal rounded-2xl p-4">
                    <span className="text-phantom">Portfolio Value: </span>
                    <span className="text-white">
                      $
                      {calculatePortfolioTotals(
                        balances,
                        tokenPrices
                      ).totalPortfolioValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={resetView}
                    className="h-12 bg-charchoal border-gray-700/50 text-gray-300 
                      hover:bg-charchoal/90 hover:text-white transition-all duration-200 rounded-xl"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {calculatePortfolioTotals(
                    balances,
                    tokenPrices
                  ).accumulatedTokens.map((token) => (
                    <TokenCard
                      key={token.mint}
                      name={token.name}
                      symbol={token.symbol}
                      balance={token.totalBalance}
                      price={token.price}
                      value={token.totalValue}
                      logoURI={token.logoURI}
                      isVerified={token.isVerified}
                      mint={token.mint}
                      priceChange24h={token.priceChange24h}
                      isNative={
                        token.mint ===
                        "So11111111111111111111111111111111111111112"
                      }
                    />
                  ))}
                </div>

                <div className="mt-8">
                  <h2 className="text-2xl font-semibold text-white mb-4">
                    Wallets Linked
                  </h2>
                  <div className="space-y-4">
                    {Object.entries(balances).map(
                      ([wallet, { solBalance, tokens }]) => {
                        const walletTotal = tokens.reduce((acc, token) => {
                          return (
                            acc +
                            (token.price ? token.balance * token.price : 0)
                          );
                        }, solBalance * Number(tokenPrices["So11111111111111111111111111111111111111112"]?.price || 0));

                        return (
                          <div
                            key={wallet}
                            className="bg-charchoal rounded-xl p-4"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <WalletIcon className="h-4 w-4 text-gray-400" />
                                <div className="flex items-center gap-1.5">
                                  <span className="text-gray-300">
                                    {wallet.slice(0, 4)}...{wallet.slice(-4)}
                                  </span>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(
                                          wallet
                                        );
                                        setIsCopied(wallet);
                                        setTimeout(() => setIsCopied(""), 2000);
                                      } catch (err) {
                                        console.error("Failed to copy:", err);
                                      }
                                    }}
                                    className="text-gray-500 hover:text-gray-300 transition-colors"
                                  >
                                    {isCopied === wallet ? (
                                      <Check className="h-3.5 w-3.5 text-green-500" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              <div className="text-white font-medium">
                                $
                                {walletTotal.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {[
                                { symbol: "SOL", balance: solBalance },
                                ...tokens.filter(
                                  (t) => t.price && t.balance * t.price >= 1
                                ),
                              ].map((token, i) => (
                                <div
                                  key={i}
                                  className="bg-gray-800/50 rounded-lg px-2 py-1 text-sm flex items-center gap-1.5"
                                >
                                  <span className="text-gray-400">
                                    {token.symbol}:
                                  </span>
                                  <span className="text-gray-200">
                                    {token.balance.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
