import { Link } from 'react-router-dom';
import ThemeToggle from '@shared/ui/ThemeToggle';
import Navigation from '@features/home/components/Navigation';
import { 
  Check,
  PanelsTopLeft,
  Users,
  Shapes,
  History,
  Brush,
  Server,
  Share2,
  ChevronRight,
  Sparkles,
  Code2,
  GitBranch,
  Cuboid,
  Rocket
} from 'lucide-react';

const tech = [
  { icon: 'fa-react', label: 'React', color: 'text-sky-400' },
  { icon: 'fa-js', label: 'JavaScript', color: 'text-yellow-400' },
  { icon: 'fa-node-js', label: 'Node.js', color: 'text-green-500' },
  { icon: 'fa-server', label: 'WebSockets', color: 'text-purple-400' },
];

const features = [
  { icon: PanelsTopLeft, title: 'Pan & zoom', description: 'Navigate freely around the canvas' },
  { icon: Share2, title: 'Real-time sync', description: 'Changes appear for everyone instantly' },
  { icon: Users, title: 'Collaborative cursors', description: 'See teammates\' positions live' },
  { icon: Shapes, title: 'Rich toolset', description: 'Shapes, text, connectors, sticky notes, images' },
  { icon: History, title: 'History', description: 'Undo / redo across all actions' },
];

const team = [
  { name: 'Nikhil', role: 'Full-stack Developer' },
];

const AboutPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
      <ThemeToggle />
      <Navigation />

      <main className="flex-1 pt-24">
        {/* Hero */}
        <section className="py-20 text-center px-4">
          <div className="inline-flex items-center px-4 py-2 rounded-full border border-border/50 bg-muted mb-6 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 mr-2" />
            Real-time Collaboration
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter leading-tight mb-6">
            About <span className="gradient-text">Aakrity</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A real-time collaborative whiteboard designed to make visual teamwork
            fast, intuitive, and truly live.
          </p>
        </section>

        {/* What is it */}
        <section className="py-16 bg-muted/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-black mb-4">What is Aakrity?</h2>
                <p className="text-muted-foreground mb-4">
                  Aakrity is a real-time collaborative whiteboard. Multiple users can draw shapes,
                  write sticky notes, connect ideas, and see each other's cursors — all live, with zero delay.
                </p>
                <p className="text-muted-foreground">
                  The project was built to explore modern web technologies: React for the UI, WebSockets for
                  real-time sync, and a custom canvas rendering engine for smooth performance.
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-card p-8 space-y-4">
                {features.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="flex items-start space-x-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-primary" strokeWidth={3} />
                    </div>
                    <div>
                      <span className="font-semibold text-sm">{title}</span>
                      <span className="text-muted-foreground text-sm"> — {description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-black mb-10 text-center">Tech Stack</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {tech.map(({ icon, label, color }) => (
                <div key={label} className="rounded-2xl border border-border bg-card p-6 text-center hover-lift">
                  <i className={`fab ${icon} text-4xl ${color} mb-3 block`}></i>
                  <span className="text-sm font-semibold">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { icon: Brush, label: 'Tailwind CSS' },
                { icon: Server, label: 'Socket.io' },
                { icon: Rocket, label: 'Vite' },
                { icon: Cuboid, label: 'Zustand' },
                { icon: GitBranch, label: 'React Router' },
                { icon: Code2, label: 'Canvas API' }
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="py-16 bg-muted/20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-black mb-10">The Team</h2>
            <div className="flex flex-wrap gap-6 justify-center">
              {team.map(({ name, role }) => (
                <div key={name} className="rounded-3xl border border-border bg-card p-8 w-56 hover-lift">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border mx-auto mb-4">
                    <img src="/icons/pfp.webp" alt={name} className="w-full h-full object-cover object-top scale-125 origin-top" />
                  </div>
                  <div className="font-bold">{name}</div>
                  <div className="text-sm text-muted-foreground mt-1">{role}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 text-center px-4">
          <h2 className="text-3xl font-black mb-4">Try it yourself</h2>
          <p className="text-muted-foreground mb-8">Create an account and open a room to start drawing with others.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/register" className="group px-8 py-3 font-semibold bg-primary text-primary-foreground rounded-full hover:opacity-90 transition btn-metallic inline-flex items-center gap-2">
              Get Started Free
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/contact" className="px-8 py-3 font-semibold border border-border rounded-full hover:bg-muted transition-colors">
              Contact Us
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/50 flex items-center justify-center gap-2">
        <span>© {new Date().getFullYear()} Aakrity</span>
        <span className="w-1 h-1 rounded-full bg-border/50"></span>
        <Link to="/" className="hover:text-foreground transition-colors flex items-center gap-1">
          Home
        </Link>
        <span className="w-1 h-1 rounded-full bg-border/50"></span>
        <Link to="/contact" className="hover:text-foreground transition-colors flex items-center gap-1">
          Contact
        </Link>
      </footer>
    </div>
  );
};

export default AboutPage;