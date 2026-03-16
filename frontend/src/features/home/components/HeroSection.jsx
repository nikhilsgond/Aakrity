import { Link } from 'react-router-dom';

const HeroSection = () => {
  return (
    <section className="min-h-screen pt-20 flex items-center justify-center relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0">
        <svg className="w-full h-full" viewBox="0 0 1920 1080" fill="none">
          {/* Curved paths */}
          <path className="drawing-line" d="M200 400 Q400 300 600 400 T1000 400" stroke="hsl(var(--foreground) / 0.07)" strokeWidth="2" fill="none"/>
          <path className="drawing-line" d="M1500 600 Q1700 500 1800 600" stroke="hsl(var(--foreground) / 0.07)" strokeWidth="2" fill="none" style={{animationDelay: '0.5s'}}/>
          <path className="drawing-line" d="M300 800 Q500 700 700 800" stroke="hsl(var(--foreground) / 0.07)" strokeWidth="2" fill="none" style={{animationDelay: '1s'}}/>
          <path d="M1200 100 Q1400 180 1600 100 T1920 150" stroke="hsl(var(--foreground) / 0.05)" strokeWidth="2" fill="none"/>
          <path d="M0 700 Q200 620 400 700 T800 680" stroke="hsl(var(--foreground) / 0.05)" strokeWidth="2" fill="none"/>
          {/* Rectangles */}
          <rect x="80" y="120" width="90" height="55" rx="8" stroke="hsl(var(--foreground) / 0.06)" strokeWidth="1.5" fill="none"/>
          <rect x="1700" y="200" width="110" height="60" rx="8" stroke="hsl(var(--foreground) / 0.06)" strokeWidth="1.5" fill="none"/>
          <rect x="1550" y="820" width="80" height="50" rx="6" stroke="hsl(var(--foreground) / 0.05)" strokeWidth="1.5" fill="none"/>
          <rect x="250" y="900" width="100" height="56" rx="8" stroke="hsl(var(--foreground) / 0.05)" strokeWidth="1.5" fill="none"/>
          <rect x="1300" y="880" width="70" height="42" rx="6" stroke="hsl(var(--foreground) / 0.04)" strokeWidth="1" fill="none"/>
          {/* Small circles */}
          <circle cx="140" cy="620" r="22" stroke="hsl(var(--foreground) / 0.07)" strokeWidth="1.5" fill="none"/>
          <circle cx="1780" cy="780" r="18" stroke="hsl(var(--foreground) / 0.06)" strokeWidth="1.5" fill="none"/>
          <circle cx="950" cy="950" r="28" stroke="hsl(var(--foreground) / 0.05)" strokeWidth="1.5" fill="none"/>
          <circle cx="1650" cy="420" r="14" stroke="hsl(var(--foreground) / 0.06)" strokeWidth="1.5" fill="none"/>
          <circle cx="380" cy="200" r="16" stroke="hsl(var(--foreground) / 0.05)" strokeWidth="1.5" fill="none"/>
          {/* Diamond shapes */}
          <polygon points="1100,80 1120,100 1100,120 1080,100" stroke="hsl(var(--foreground) / 0.06)" strokeWidth="1.5" fill="none"/>
          <polygon points="460,950 485,975 460,1000 435,975" stroke="hsl(var(--foreground) / 0.05)" strokeWidth="1.5" fill="none"/>
          <polygon points="1820,500 1840,520 1820,540 1800,520" stroke="hsl(var(--foreground) / 0.05)" strokeWidth="1.5" fill="none"/>
          {/* Connector lines between shapes */}
          <line x1="170" y1="120" x2="170" y2="598" stroke="hsl(var(--foreground) / 0.04)" strokeWidth="1" strokeDasharray="4 6"/>
          <line x1="1700" y1="260" x2="1650" y2="406" stroke="hsl(var(--foreground) / 0.04)" strokeWidth="1" strokeDasharray="4 6"/>
        </svg>
        <div className="absolute top-1/4 left-10 w-72 h-72 rounded-full border border-border/40 animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-10 w-96 h-96 rounded-full border border-border/40 animate-pulse-slow" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-16 right-1/4 w-32 h-32 rounded-full border border-border/30 animate-pulse-slow" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-16 left-1/4 w-48 h-48 rounded-full border border-border/25 animate-pulse-slow" style={{animationDelay: '1.5s'}}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 z-10 relative text-center">
        {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 rounded-full border border-border/50 bg-muted mb-8 animate-fade-in-up">
            <span className="text-sm text-muted-foreground">Real-time Collaborative Whiteboard</span>
          </div>

        {/* Headline */}
        <h1 
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-[6rem] font-black tracking-tighter leading-[0.9] mb-6 animate-fade-in-up"
          style={{animationDelay: '0.1s'}}
        >
          <span className="block">Where teams</span>
          <span className="block gradient-text">think together</span>
        </h1>

        {/* Subheadline */}
        <p 
          className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 animate-fade-in-up"
          style={{animationDelay: '0.2s'}}
        >
          The canvas for real-time collaboration. Design, diagram, and brainstorm with your team in a shared visual workspace.
        </p>

        {/* CTA Buttons */}
        <div 
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in-up"
          style={{animationDelay: '0.3s'}}
        >
          <Link to="/register" className="px-8 py-6 text-lg font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition flex items-center justify-center space-x-3 group btn-metallic">
            <span>Start for free</span>
            <i className="fas fa-arrow-right group-hover:translate-x-2 transition-transform"></i>
          </Link>
          <Link to="/about" className="px-8 py-6 text-lg font-medium border-2 border-border rounded-full hover:bg-muted transition flex items-center justify-center space-x-3">
            <i className="fas fa-info-circle"></i>
            <span>Learn more</span>
          </Link>
        </div>

        {/* Stats */}
        <div 
          className="flex flex-wrap justify-center gap-8 md:gap-16 animate-fade-in-up"
          style={{animationDelay: '0.4s'}}
        >
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-black mb-2">Live</div>
            <div className="text-sm text-muted-foreground">Real-time Sync</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-black mb-2">6+</div>
            <div className="text-sm text-muted-foreground">Drawing Tools</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-black mb-2">Multi</div>
            <div className="text-sm text-muted-foreground">User Rooms</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-black mb-2">Chat</div>
            <div className="text-sm text-muted-foreground">Built-in</div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce-subtle">
        <div className="w-6 h-10 border-2 border-muted-foreground rounded-full flex justify-center">
          <div className="w-1 h-3 bg-muted-foreground rounded-full mt-2"></div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection