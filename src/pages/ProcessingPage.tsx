import CheckList from '../components/Content';
import PageHero from '../components/PageHero';
export default function ProcessingPage() { return <PageHero image="/images/processing-scene.png" eyebrow="OUR PROCESS" title={<>World-Class<br/>Processing & Quality</>} description="Our advanced processing facilities ensure the highest standards of hygiene, safety and quality at every step." action="Discuss Our Quality Standards" to="/contact"><CheckList items={['Modern Processing Units','Strict Quality Control','International Food Safety Standards','Cold Chain Management']}/></PageHero>; }
