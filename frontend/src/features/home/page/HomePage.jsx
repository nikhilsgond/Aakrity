import Navigation from '../components/Navigation'
import ThemeToggle from '@shared/ui/ThemeToggle'
import HeroSection from '../components/HeroSection'
import CanvasShowcase from '../components/CanvasShowcase'
import ToolsGrid from '../components/ToolsGrid'
import CollaborationSection from '../components/CollaborationSection'
import UserChatSection from '../components/UserChatSection'
import CommunitySection from '../components/CommunitySection'
import Footer from '../components/Footer'

const Home = () => {
  return (
    <div className="transition-colors duration-300">
      <ThemeToggle />
      <Navigation />
      <HeroSection />
      <CanvasShowcase />
      <ToolsGrid />
      <CollaborationSection />
      <UserChatSection />
      <CommunitySection />
      <Footer />
    </div>
  )
}

export default Home

