import PageHero from '../components/PageHero';
import ProductGrid, { ProductCategoryStrip } from '../components/ProductGrid';
export default function ProductsPage() { return <><PageHero image="/images/products-scene.png" eyebrow="OUR PRODUCTS" title={<>Premium Seafood<br/>for Global Markets</>} description="We offer a wide range of high-quality seafood products sourced from the pristine waters." action="Request Product Details" to="/contact" bottomContent={<ProductCategoryStrip/>}/><ProductGrid/></>; }
