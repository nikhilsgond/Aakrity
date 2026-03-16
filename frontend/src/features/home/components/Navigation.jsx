import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Features', to: '/features' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

const Navigation = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <header 
      id="header" 
      className={`fixed top-0 left-0 right-0 z-40 py-4 bg-background/80 backdrop-blur-xl border-b border-border/50 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <i className="fas fa-pen-nib text-primary-foreground text-lg"></i>
            </div>
            <Link to="/" className="text-2xl font-black tracking-tight">Aakrity</Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-10">
            {navLinks.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                className={`text-sm font-medium transition-colors ${
                  location.pathname === to.split('#')[0]
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA Buttons */}
          <div className="hidden lg:flex items-center space-x-4">
            <Link to="/login" className="px-6 py-2 text-sm font-medium border border-border rounded-full hover:bg-muted transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition btn-metallic">
              Get Started Free
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden w-10 h-10 rounded-lg border border-border flex items-center justify-center"
          >
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`${mobileMenuOpen ? 'block' : 'hidden'} mobile-menu lg:hidden mt-4 pb-4 border-t border-border pt-4`}>
          <div className="space-y-4">
            {navLinks.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-base font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            ))}
            <div className="pt-4 space-y-3">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block w-full py-3 text-base font-medium border border-border rounded-full hover:bg-muted transition-colors text-center">
                Sign In
              </Link>
              <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block w-full py-3 text-base font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition text-center btn-metallic">
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navigation;