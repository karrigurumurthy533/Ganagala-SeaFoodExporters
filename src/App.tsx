import { Routes, Route } from 'react-router-dom';
import SiteLayout from './components/SiteLayout';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ProductsPage from './pages/ProductsPage';
import ProcessingPage from './pages/ProcessingPage';
import InfrastructurePage from './pages/InfrastructurePage';
import MarketsPage from './pages/MarketsPage';
import ContactPage from './pages/ContactPage';

export default function App() {
  return <Routes><Route element={<SiteLayout />}>
    <Route index element={<HomePage />} />
    <Route path="about" element={<AboutPage />} />
    <Route path="products" element={<ProductsPage />} />
    <Route path="processing-quality" element={<ProcessingPage />} />
    <Route path="infrastructure" element={<InfrastructurePage />} />
    <Route path="export-markets" element={<MarketsPage />} />
    <Route path="contact" element={<ContactPage />} />
    <Route path="*" element={<HomePage />} />
  </Route></Routes>;
}
