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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";

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

        walletTokens = await Promise.all(
          walletTokens.map(async (token) => {
            if (prices[token.mint]) {
              token.price = Number(prices[token.mint].price);
              token.value = token.balance * token.price;

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
    <div className="min-h-screen bg-black text-white">
      <main className="container mx-auto px-4 py-8">
        <Card className="bg-white text-black border-black">
          <CardHeader>
            <div className="flex items-center justify-center space-x-4">
              <WalletIcon className="h-10 w-10 text-black" />
              <div>
                <CardTitle className="text-3xl font-bold">
                  Solana Portfolio Tracker
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Sync and view all your SPL token balances in one place
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
                    className="bg-white border-black text-black"
                  />
                  {wallets.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setWallets(wallets.filter((_, i) => i !== index))
                      }
                      className="text-black hover:text-white hover:bg-black"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="w-full bg-white border-black text-black hover:bg-black hover:text-white"
                  onClick={() => setWallets([...wallets, ""])}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Another Wallet
                </Button>

                <Button
                  className="w-full bg-black text-white hover:bg-white hover:text-black border border-black"
                  onClick={fetchTokenBalances}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "View Balances"
                  )}
                </Button>
              </div>
            </div>

            {Object.entries(balances).length > 0 && (
              <div className="mt-8 space-y-6">
                <h2 className="text-2xl font-semibold">Token Balances</h2>
                {Object.entries(balances).map(
                  ([wallet, { solBalance, tokens }]) => (
                    <Card key={wallet} className="bg-white border-black">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
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
                            price={
                              tokenPrices?.[
                                "So11111111111111111111111111111111111111112"
                              ]?.price
                            }
                            logoURI="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                            isNative
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
                                logoURI={token.logoURI}
                                isVerified={token.tags?.includes("verified")}
                                mint={token.mint}
                                confidenceLevel={token.confidenceLevel}
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

interface TokenCardProps {
  name: string;
  symbol: string;
  balance: number;
  price?: string | number;
  logoURI?: string;
  isNative?: boolean;
  isVerified?: boolean;
  mint?: string;
  confidenceLevel?: string;
}

function TokenCard({
  name,
  symbol,
  balance,
  price,
  logoURI,
  isNative,
  isVerified,
  mint,
  confidenceLevel,
}: TokenCardProps) {
  const numericPrice = typeof price === "string" ? parseFloat(price) : price;
  const value = numericPrice ? balance * numericPrice : undefined;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="bg-white border border-black rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow duration-200 cursor-pointer">
            <div className="flex items-center space-x-3 mb-2">
              {logoURI ? (
                <img
                  src={logoURI}
                  alt={`${symbol} logo`}
                  className="w-8 h-8 rounded-full"
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";
                  }}
                />
              ) : (
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
              )}
              <div>
                <h3 className="font-semibold text-lg">
                  {symbol}{" "}
                  {isVerified && (
                    <span className="text-green-500 text-sm ml-1">✓</span>
                  )}
                </h3>
                <p className="text-sm text-gray-600">{name}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm">
                Balance:{" "}
                <span className="font-medium">
                  {balance.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </span>
              </p>
              {numericPrice && (
                <p className="text-sm">
                  Price:{" "}
                  <span className="font-medium">
                    ${formatTokenPrice(numericPrice)}
                  </span>
                  {confidenceLevel && (
                    <span
                      className={`ml-1 text-xs ${
                        confidenceLevel === "high"
                          ? "text-green-500"
                          : confidenceLevel === "medium"
                          ? "text-yellow-500"
                          : "text-red-500"
                      }`}
                    >
                      ({confidenceLevel})
                    </span>
                  )}
                </p>
              )}
              {value && (
                <p className="text-sm">
                  Value:{" "}
                  <span className="font-medium">${value.toFixed(2)}</span>
                </p>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isNative ? "Native SOL" : `Token Address: ${mint}`}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatTokenPrice(price: number): string {
  if (price < 0.01) {
    return `$${price.toFixed(8)}`; // For very low prices
  } else if (price < 1) {
    return `$${price.toFixed(4)}`; // For prices less than $1
  } else {
    return `$${price.toFixed(2)}`; // For prices $1 and above
  }
}
