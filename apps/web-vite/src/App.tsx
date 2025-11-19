import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThirdwebProvider } from 'thirdweb/react';
import Header from '@/components/Header';
import ChainSwitcher from '@/components/ChainSwitcher';
import { ToastProvider } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Pages
import Home from '@/pages/Home';
import MarketDetail from '@/pages/MarketDetail';
import Portfolio from '@/pages/Portfolio';
import Create from '@/pages/Create';
import BecomeCreator from '@/pages/BecomeCreator';
import Admin from '@/pages/admin/Admin';

function App() {
  return (
    <BrowserRouter>
      <ThirdwebProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Header />
            <ChainSwitcher />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/market/:id" element={<MarketDetail />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/create" element={<Create />} />
              <Route path="/become-creator" element={<BecomeCreator />} />
              <Route path="/yesno-admin" element={<Admin />} />
            </Routes>
          </ErrorBoundary>
        </ToastProvider>
      </ThirdwebProvider>
    </BrowserRouter>
  );
}

export default App;
