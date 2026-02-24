import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { injectedWallet, metaMaskWallet, walletConnectWallet, trustWallet } from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider, http } from 'wagmi';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { defineChain } from 'viem';

// ── Define OpenGradient Chain ──
export const openGradient = defineChain({
    id: 10740,
    name: 'OpenGradient Testnet',
    nativeCurrency: { name: 'OG ETH', symbol: 'OGETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://ogevmdevnet.opengradient.ai'] },
    },
    blockExplorers: {
        default: { name: 'Explorer', url: 'https://explorer.opengradient.ai' },
    },
});

const config = getDefaultConfig({
    appName: 'Predict 402',
    // Get a real projectId from https://cloud.walletconnect.com
    // Without it, only injected wallets (MetaMask extension) will work
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'b1e3f4c2a8d94e7b8c3f2a1d5e6b7c8a',
    chains: [openGradient],
    wallets: [
        {
            groupName: 'Recommended',
            wallets: [metaMaskWallet],
        },
    ],
    transports: {
        [openGradient.id]: http('https://ogevmdevnet.opengradient.ai', {
            batch: true,
            retryCount: 2,
        }),
    },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#c4a35a',
                        accentColorForeground: 'white',
                        borderRadius: 'medium',
                    })}
                    initialChain={openGradient}
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
