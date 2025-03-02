import { writeFileSync } from "fs";
import oneInch, {
  supportedChains as oneInchSupportedChains,
} from "./list-handlers/oneInch";
import parawap, {
  supportedChains as paraswapSupportedChains,
} from "./list-handlers/paraswap";
import coingecko, {
  getCoinGeckoTopTokenInfo,
  supportedChains as cgSupportedChains,
} from "./list-handlers/coingecko";
import changelly from "./list-handlers/changelly";
import { NetworkName, Token } from "./types";
import { CHAIN_CONFIGS, NATIVE_ADDRESS } from "./configs";

const runner = async () => {
  const oneInchTokens: Record<string, Record<string, Token>> = {};
  const paraswapTokens: Record<string, Record<string, Token>> = {};
  const coingeckoTokens: Record<string, Record<string, Token>> = {};
  const allChains = Object.values(NetworkName);
  const cgPromises = cgSupportedChains.map((chain, idx) =>
    coingecko(chain).then((results) => {
      coingeckoTokens[cgSupportedChains[idx]] = results;
    })
  );
  const oneInchPromises = oneInchSupportedChains.map((chain, idx) =>
    oneInch(chain).then((results) => {
      oneInchTokens[oneInchSupportedChains[idx]] = results;
    })
  );
  const paraswapPromises = paraswapSupportedChains.map((chain, idx) =>
    parawap(chain).then((results) => {
      paraswapTokens[paraswapSupportedChains[idx]] = results;
    })
  );
  const topTokenInfo = await getCoinGeckoTopTokenInfo();
  Promise.all(cgPromises.concat(oneInchPromises).concat(paraswapPromises)).then(
    () => {
      const allResults = [coingeckoTokens, oneInchTokens, paraswapTokens];
      allChains.forEach((chain) => {
        const tokens: Token[] = [];
        const topTokens: { score: number; token: Token }[] = [];
        const trendingTokens: { score: number; token: Token }[] = [];
        const includedTokens: string[] = [];
        const addTokensIfNotAdded = (items: Record<string, Token>) => {
          const addresses = Object.keys(items);
          addresses.forEach((address) => {
            if (includedTokens.includes(address)) return;
            const token: Token = {
              address: items[address].address,
              decimals: items[address].decimals,
              logoURI: items[address].logoURI,
              name: items[address].name,
              symbol: items[address].symbol,
            };
            const cgId = topTokenInfo.contractsToId[address];
            if (cgId) {
              if (topTokenInfo.topTokens[cgId])
                token.rank = topTokenInfo.topTokens[cgId] as number;
              token.cgId = cgId as string;
            }
            if (address !== NATIVE_ADDRESS) tokens.push(token);
            if (address === NATIVE_ADDRESS) {
              token.cgId = CHAIN_CONFIGS[chain].cgId;
              tokens.unshift(token);
            }
            includedTokens.push(address);
            if (!cgId) return;
            if (topTokenInfo.topTokens[cgId])
              topTokens.push({
                score: topTokenInfo.topTokens[cgId] as number,
                token,
              });
            if (topTokenInfo.trendingTokens[cgId])
              trendingTokens.push({
                score: topTokenInfo.trendingTokens[cgId] as number,
                token,
              });
          });
        };
        allResults.forEach((res) => {
          if (res[chain]) addTokensIfNotAdded(res[chain]);
        });
        const native = tokens.shift();
        tokens.sort((a, b) => a.name.localeCompare(b.name));
        tokens.unshift(native);
        topTokens.sort((a, b) => a.score - b.score);
        trendingTokens.sort((a, b) => a.score - b.score);
        writeFileSync(
          `./dist/lists/${chain}.json`,
          JSON.stringify({
            all: tokens,
            trending: trendingTokens.map((t) => t.token),
            top: topTokens.map((t) => t.token),
          })
        );
      });
    }
  );
  const changellyTokens = await changelly();
  writeFileSync(`./dist/lists/changelly.json`, JSON.stringify(changellyTokens));
};
runner();
