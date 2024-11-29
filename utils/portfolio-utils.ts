import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface TokenBalance {
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

export interface WalletBalances {
  [wallet: string]: {
    solBalance: number;
    tokens: TokenBalance[];
  };
}

export interface TokenPrice {
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

export interface TokenPrices {
  [mint: string]: TokenPrice;
}

export interface AccumulatedToken {
  mint: string;
  symbol: string;
  name: string;
  totalBalance: number;
  price?: number;
  totalValue?: number;
  logoURI?: string;
  isVerified?: boolean;
  priceChange24h?: number;
}

export async function fetchSolanaTokenPrices(tokens: TokenBalance[]) {
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

export async function fetchTokenBalances(
  wallets: string[],
  connection: Connection,
  setTokenPrices: (prices: TokenPrices) => void,
  setBalances: (balances: WalletBalances) => void,
  setHasLoadedData: (loaded: boolean) => void
) {
  const newBalances: WalletBalances = {};

  try {
    for (const wallet of wallets) {
      if (!wallet) continue;

      const pubKey = new PublicKey(wallet);
      const solBalance = await connection.getBalance(pubKey);
      const solBalanceInSOL = solBalance / 10 ** 9;

      const prices = await fetchSolanaTokenPrices([
        {
          mint: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          name: "Solana",
          balance: solBalanceInSOL,
        } as TokenBalance,
      ]);

      setTokenPrices(prices);

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

      const allTokenPrices = await fetchSolanaTokenPrices([...walletTokens]);
      setTokenPrices({ ...prices, ...allTokenPrices });

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
    setHasLoadedData(true);
  } catch (error) {
    console.error("Error fetching balances:", error);
  }
}

export function calculatePortfolioTotals(
  balances: WalletBalances,
  tokenPrices: TokenPrices
) {
  const tokenMap = new Map<string, AccumulatedToken>();
  let totalPortfolioValue = 0;

  Object.values(balances).forEach(({ solBalance }) => {
    const solPrice = Number(
      tokenPrices["So11111111111111111111111111111111111111112"]?.price || 0
    );
    const solValue = solBalance * solPrice;
    totalPortfolioValue += solValue;

    const existingSol = tokenMap.get(
      "So11111111111111111111111111111111111111112"
    );
    tokenMap.set("So11111111111111111111111111111111111111112", {
      mint: "So11111111111111111111111111111111111111112",
      symbol: "SOL",
      name: "Solana",
      totalBalance: (existingSol?.totalBalance || 0) + solBalance,
      price: solPrice,
      totalValue: (existingSol?.totalValue || 0) + solValue,
      logoURI:
        "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
      isVerified: true,
      priceChange24h:
        tokenPrices["So11111111111111111111111111111111111111112"]
          ?.priceChange?.["24h"],
    });
  });

  Object.values(balances).forEach(({ tokens }) => {
    tokens.forEach((token) => {
      if (token.price && token.balance * token.price >= 1) {
        const value = token.balance * token.price;
        totalPortfolioValue += value;

        const existing = tokenMap.get(token.mint);
        tokenMap.set(token.mint, {
          mint: token.mint,
          symbol: token.symbol,
          name: token.name || "Unknown Token",
          totalBalance: (existing?.totalBalance || 0) + token.balance,
          price: token.price,
          totalValue: (existing?.totalValue || 0) + value,
          logoURI: token.logoURI,
          isVerified: token.tags?.includes("verified"),
          priceChange24h: token.priceChange24h,
        });
      }
    });
  });

  return {
    totalPortfolioValue,
    accumulatedTokens: Array.from(tokenMap.values()).sort(
      (a, b) => (b.totalValue || 0) - (a.totalValue || 0)
    ),
  };
}
