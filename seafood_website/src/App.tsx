import { Routes, Route } from "react-router-dom";
import SiteLayout from "./components/SiteLayout";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import ProductsPage from "./pages/ProductsPage";
import MarketsPage from "./pages/MarketsPage";
import ContactPage from "./pages/ContactPage";
import CheckoutPage from "./pages/CheckoutPage";
import PolicyPage from "./pages/PolicyPage";

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="export-markets" element={<MarketsPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="refund-policy" element={<PolicyPage policy="refund" />} />
        <Route path="terms-and-conditions" element={<PolicyPage policy="terms" />} />
        <Route path="privacy-policy" element={<PolicyPage policy="privacy" />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}