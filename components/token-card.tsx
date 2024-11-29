"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TokenCardProps {
  name: string;
  symbol: string;
  balance: number;
  price?: string | number;
  value?: number;
  logoURI?: string;
  isNative?: boolean;
  isVerified?: boolean;
  mint?: string;
  priceChange24h?: number;
}

function formatTokenPrice(price: number): string {
  if (price < 0.01) return `${price.toFixed(8)}`;
  if (price < 1) return `${price.toFixed(4)}`;
  return `${price.toFixed(2)}`;
}

export function TokenCard({
  name,
  symbol,
  balance,
  price,
  logoURI,
  isVerified,
  priceChange24h,
}: TokenCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const numericPrice = typeof price === "string" ? parseFloat(price) : price;
  const value = numericPrice ? balance * numericPrice : undefined;

  return (
    <motion.div
      whileHover={{
        scale: 1.02,
        y: -4,
      }}
      initial={{ scale: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 17,
        mass: 0.8,
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="outline-none"
    >
      <Card className="bg-charchoal border border-gray-800/60 transition-all duration-300 overflow-hidden">
        <motion.div
          initial={{ opacity: 1 }}
          whileHover={{ opacity: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {logoURI ? (
                  <img
                    src={logoURI}
                    alt={`${symbol} logo`}
                    className="w-10 h-10 rounded-full"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 bg-phantom bg-opacity-20 rounded-full flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-phantom" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-white flex items-center">
                    <span className="text-xl">{symbol}</span>
                    {isVerified && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="ml-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-green-500/10">
                              <Check
                                className="w-3.5 h-3.5 text-green-500"
                                strokeWidth={2.5}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm">
                              This token has been verified by Jupiter and meets
                              their security standards
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </h3>
                  <p className="text-sm text-gray-400">{name}</p>
                </div>
              </div>
              <ArrowUpRight
                className={`w-5 h-5 transition-opacity duration-300 ${
                  isHovered ? "opacity-100" : "opacity-0"
                } text-phantom`}
              />
            </div>
            <div className="space-y-4">
              {value && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Value</span>
                  <span className="font-bold text-xl text-white">
                    $
                    {value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Balance</span>
                <span className="font-medium text-white">
                  {balance.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </span>
              </div>
              {numericPrice && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Price</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">
                      ${formatTokenPrice(numericPrice)}
                    </span>
                    {priceChange24h !== undefined && (
                      <span
                        className={`font-medium ${
                          priceChange24h >= 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {priceChange24h >= 0 ? "↑" : "↓"}
                        {Math.abs(priceChange24h).toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </motion.div>
      </Card>
    </motion.div>
  );
}
