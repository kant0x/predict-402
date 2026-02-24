import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { AlphaBanner } from './components/AlphaBanner';
import { NicknameModal } from './components/NicknameModal';
import { Toast } from './components/Toast';
import { HomePage } from './pages/GamePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { HowToPlayPage } from './pages/HowToPlayPage';
import { BotBuilderPage } from './pages/BotBuilderPage';
import { BitQuantPage } from './pages/BitQuantPage';
import { useNickname, useRegisterNickname, usePlaceBet, useCurrentRoundBets } from './hooks/useContract';

function AppContent() {
  const { address, isConnected, chain } = useAccount();
  const { nickname, isLoading: nickLoading } = useNickname(address);
  const { register, isPending: isRegistering, isSuccess: regSuccess, error: regError } = useRegisterNickname();
  const { placeBet, isPending: isBetting, isSuccess: betSuccess, error: betError } = usePlaceBet();
  const { bets, refetch: refetchBets } = useCurrentRoundBets();

  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [currentNickname, setCurrentNickname] = useState('');

  // Check nickname on connect
  useEffect(() => {
    const isWrongNetwork = chain?.id !== 10740;
    if (isConnected && address && !nickLoading) {
      if (isWrongNetwork) {
        setShowNicknameModal(true);
      } else if (!nickname) {
        setShowNicknameModal(true);
      } else {
        setCurrentNickname(nickname);
        setShowNicknameModal(false);
      }
    }
  }, [isConnected, address, nickname, nickLoading, chain?.id]);

  // Handle registration success
  useEffect(() => {
    if (regSuccess) {
      setShowNicknameModal(false);
      setToast({ message: 'Nickname registered!', type: 'success' });
    }
  }, [regSuccess]);

  // Handle registration error
  useEffect(() => {
    if (regError) {
      console.error('Registration error:', regError);
      const msg = regError.message?.includes('User rejected')
        ? 'Transaction rejected'
        : 'Registration failed: ' + (regError.message || 'Unknown error');
      setToast({ message: msg, type: 'error' });
    }
  }, [regError]);

  // Handle bet success
  useEffect(() => {
    if (betSuccess) {
      setToast({ message: 'Bet placed successfully!', type: 'success' });
      refetchBets();
    }
  }, [betSuccess]);

  // Handle bet error
  useEffect(() => {
    if (betError) {
      const msg = betError.message?.includes('User rejected')
        ? 'Transaction rejected'
        : betError.message?.includes('insufficient')
          ? 'Insufficient balance'
          : 'Bet failed';
      setToast({ message: msg, type: 'error' });
    }
  }, [betError]);

  const handlePlaceBet = (isUp: boolean, amount: string) => {
    if (!isConnected) {
      setToast({ message: 'Connect your wallet first!', type: 'error' });
      return;
    }
    if (!currentNickname && !nickname) {
      setShowNicknameModal(true);
      return;
    }
    placeBet(isUp, amount);
  };

  const handleRegisterNickname = (nick: string) => {
    console.log('[App] handleRegisterNickname called with:', nick, 'isConnected:', isConnected);
    setCurrentNickname(nick);
    register(nick);
  };

  return (
    <>
      <AlphaBanner />
      <Header />
      <Routes>
        <Route path="/" element={
          <HomePage
            nickname={currentNickname || nickname}
            onPlaceBet={handlePlaceBet}
            bets={bets}
            isLoading={isBetting}
          />
        } />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/how-to-play" element={<HowToPlayPage />} />
        <Route path="/bots" element={<BotBuilderPage />} />
        <Route path="/bitquant" element={<BitQuantPage />} />
      </Routes>
      <Footer />

      {showNicknameModal && (
        <NicknameModal
          onSubmit={handleRegisterNickname}
          onClose={() => setShowNicknameModal(false)}
          isLoading={isRegistering}
          isWrongNetwork={chain?.id !== 10740}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

export default function App() {
  return <AppContent />;
}
