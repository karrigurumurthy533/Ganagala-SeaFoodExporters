import PageHero from '../components/PageHero';
import TrustStrip from '../components/TrustStrip';
import ProductGrid from '../components/ProductGrid';
export default function HomePage() { return <><PageHero image="/images/home-scene.png" eyebrow="PREMIUM QUALITY · GLOBAL STANDARDS" title={<>Ganagala<br/>Seafood Exporters</>} description="Delivering the Freshness of the Ocean to the World" action="Explore Our Products" to="/products" bottomContent={<TrustStrip/>}/><ProductGrid/></>; }
