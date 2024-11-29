"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Sparkles } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { TokenCard } from "@/components/token-card";

interface TokenBalance {
  mint: string;
  symbol: string;
  balance: number;
  name?: string;
  price?: number;
  value?: number;
  confidenceLevel?: string;
  tags?: string[];
  logoURI?: string;
  priceChange24h?: number;
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

interface TokenPrices {
  [mint: string]: TokenPrice;
}

export function LandingPage() {
  const [wallets, setWallets] = useState<string[]>([""]);
  const [balances, setBalances] = useState<WalletBalances>({});
  const [isLoading, setIsLoading] = useState(false);
  const [tokenPrices, setTokenPrices] = useState<TokenPrices>({});
  const [verifiedTokens, setVerifiedTokens] = useState<{ [key: string]: any }>(
    {}
  );
  const [isCopied, setIsCopied] = useState<string>("");

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

  async function fetchSolanaTokenPrices(tokens: TokenBalance[]) {
    try {
      const tokenIds = tokens.map((t) => t.mint).join(",");
      const response = await fetch(`/api/jupiter-price?ids=${tokenIds}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch prices: ${response.status}`);
      }

      const { data } = await response.json();
      return data as TokenPrices;
    } catch (error) {
      console.error("Error fetching token prices:", error);
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
        const solBalance = await connection.getBalance(pubKey);
        const solBalanceInSOL = solBalance / 10 ** 9;

        // First fetch SOL price
        const prices = await fetchSolanaTokenPrices([
          {
            mint: "So11111111111111111111111111111111111111112",
            symbol: "SOL",
            name: "Solana",
            balance: solBalanceInSOL,
          } as TokenBalance,
        ]);

        // Set token prices in state
        setTokenPrices(prices);

        // Get other token balances
        const tokens = await connection.getParsedTokenAccountsByOwner(pubKey, {
          programId: TOKEN_PROGRAM_ID,
        });

        let walletTokens = tokens.value
          .map(
            (token) =>
              ({
                mint: token.account.data.parsed.info.mint,
                symbol: "Unknown",
                name: "Unknown Token",
                balance: Number(
                  token.account.data.parsed.info.tokenAmount.uiAmount
                ),
                price: undefined,
                value: undefined,
              } as TokenBalance)
          )
          .filter((token) => token.balance > 0);

        // Fetch prices for other tokens
        const allTokenPrices = await fetchSolanaTokenPrices([...walletTokens]);

        // Merge SOL price with other token prices
        setTokenPrices({ ...prices, ...allTokenPrices });

        // Process other tokens
        walletTokens = await Promise.all(
          walletTokens.map(async (token) => {
            if (allTokenPrices[token.mint]) {
              token.price = Number(allTokenPrices[token.mint].price);
              token.value = token.balance * token.price;
              token.priceChange24h =
                allTokenPrices[token.mint].priceChange?.["24h"];
              token.confidenceLevel =
                allTokenPrices[token.mint].extraInfo?.confidenceLevel;

              if (token.value >= 1) {
                try {
                  const tokenInfo = await fetch(
                    `/api/mint?mint=${token.mint}`
                  ).then((res) => res.json());
                  if (tokenInfo && !tokenInfo.error) {
                    token.name = tokenInfo.name;
                    token.symbol = tokenInfo.symbol;
                    token.tags = tokenInfo.tags;
                    token.logoURI = tokenInfo.logoURI;
                  }
                } catch (error) {
                  console.error(
                    `Error fetching info for token ${token.mint}:`,
                    error
                  );
                }
              }
            }
            return token;
          })
        );

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
    <div className="min-h-screen bg-gray-950 text-white">
      <main className="container mx-auto px-4 py-8">
        <Card className="bg-gray-900 border-none shadow-none">
          <CardHeader>
            <div className="flex items-center justify-center space-x-4">
              <WalletIcon className="h-10 w-10 text-blue-400" />
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
                  onClick={fetchTokenBalances}
                  disabled={isLoading}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium
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

            {Object.entries(balances).length > 0 && (
              <div className="mt-8 space-y-6">
                <h2 className="text-2xl font-semibold text-white">
                  Token Balances
                </h2>
                {Object.entries(balances).map(
                  ([wallet, { solBalance, tokens }]) => (
                    <Card
                      key={wallet}
                      className="bg-gray-900 border-none shadow-none"
                    >
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between text-white">
                          <div className="flex items-center gap-2">
                            Wallet:
                            <div className="relative flex items-center gap-1.5 min-w-[140px]">
                              <AnimatePresence mode="wait">
                                {isCopied === wallet ? (
                                  <motion.div
                                    key="copied"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="flex items-center gap-1.5 absolute"
                                  >
                                    <span>Copied!</span>
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{
                                        type: "spring",
                                        stiffness: 400,
                                        damping: 10,
                                      }}
                                    >
                                      <Check className="h-3.5 w-3.5 text-green-500" />
                                    </motion.div>
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="address"
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    className="flex items-center gap-1.5"
                                  >
                                    <span className="pointer-events-none">
                                      {wallet.slice(0, 4)}...{wallet.slice(-4)}
                                    </span>
                                    <button
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(
                                            wallet
                                          );
                                          setIsCopied(wallet);
                                          setTimeout(
                                            () => setIsCopied(""),
                                            2000
                                          );
                                        } catch (err) {
                                          console.error("Failed to copy:", err);
                                        }
                                      }}
                                      disabled={isCopied === wallet}
                                    >
                                      <motion.div
                                        whileHover={{ rotate: 15 }}
                                        transition={{
                                          type: "spring",
                                          stiffness: 400,
                                          damping: 10,
                                        }}
                                      >
                                        <Copy className="h-3.5 w-3.5 hover:text-gray-600 transition-colors" />
                                      </motion.div>
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <TokenCard
                            name="Solana"
                            symbol="SOL"
                            balance={solBalance}
                            price={Number(
                              tokenPrices[
                                "So11111111111111111111111111111111111111112"
                              ]?.price
                            )}
                            value={
                              solBalance *
                              Number(
                                tokenPrices[
                                  "So11111111111111111111111111111111111111112"
                                ]?.price || 0
                              )
                            }
                            priceChange24h={
                              tokenPrices[
                                "So11111111111111111111111111111111111111112"
                              ]?.priceChange?.["24h"]
                            }
                            logoURI="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                            isNative
                            isVerified={true}
                          />

                          {tokens
                            .filter(
                              (
                                token
                              ): token is TokenBalance & { price: number } =>
                                token.price !== undefined &&
                                token.balance * token.price >= 1
                            )
                            .map((token, i) => (
                              <TokenCard
                                key={i}
                                name={token.name || "Unknown Token"}
                                symbol={token.symbol}
                                balance={token.balance}
                                price={token.price}
                                priceChange24h={token.priceChange24h}
                                logoURI={token.logoURI}
                                isVerified={token.tags?.includes("verified")}
                                mint={token.mint}
                              />
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
