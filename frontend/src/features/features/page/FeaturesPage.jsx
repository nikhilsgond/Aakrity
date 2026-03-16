import { Link } from 'react-router-dom';
import ThemeToggle from '@shared/ui/ThemeToggle';
import Navigation from '@features/home/components/Navigation';
import {
  Pencil,
  Shapes,
  GitMerge,
  StickyNote,
  Type,
  Image,
  Users,
  MousePointer2,
  MessageSquare,
  Lock,
  History,
  Sun,
  Home,
  Phone
} from 'lucide-react';

const features = [
  {
    icon: Pencil,
    title: 'Freehand Drawing',
    desc: 'Draw freely with a smooth pencil. Adjustable stroke width and color. Use the eraser to correct any mistakes precisely.',
    tags: ['Pencil Tool', 'Eraser Tool'],
  },
  {
    icon: Shapes,
    title: 'Shapes',
    desc: 'Place rectangles, circles, triangles, diamonds and more with configurable fill, border color, and opacity.',
    tags: ['Rectangles', 'Circles', 'Polygons'],
  },
  {
    icon: GitMerge,
    title: 'Connectors',
    desc: 'Smart connector lines that snap to shapes. Straight and curved routing with arrow heads for diagrams and flowcharts.',
    tags: ['Auto-route', 'Arrows', 'Elbow Lines'],
  },
  {
    icon: StickyNote,
    title: 'Sticky Notes',
    desc: 'Click to place sticky notes anywhere. 12 color options. Double-click to edit, with bold and italic formatting support.',
    tags: ['12 Colors', 'Rich Text', 'Bold / Italic'],
  },
  {
    icon: Type,
    title: 'Text Tool',
    desc: 'Add resizable text blocks anywhere on the canvas. Inline formatting with alignment and size controls.',
    tags: ['Text Blocks', 'Bold / Italic'],
  },
  {
    icon: Image,
    title: 'Image Upload',
    desc: 'Drag and drop images onto the canvas. Resize and reposition them freely within the shared workspace.',
    tags: ['Drag & Drop', 'PNG / JPG'],
  },
  {
    icon: Users,
    title: 'Multi-user Rooms',
    desc: 'Create a room and share the link. Anyone who joins can draw, edit, and collaborate in real-time simultaneously.',
    tags: ['Room Links', 'Multi-user'],
  },
  {
    icon: MousePointer2,
    title: 'Live Cursors',
    desc: "See every connected user's cursor on the canvas with their name label — updated in real-time as they move.",
    tags: ['Real-time', 'Named Cursors'],
  },
  {
    icon: MessageSquare,
    title: 'Built-in Chat',
    desc: 'Text chat panel directly inside every room. Send messages to collaborators without leaving the canvas.',
    tags: ['Live Chat', 'Room-scoped'],
  },
  {
    icon: Lock,
    title: 'Shape Locking',
    desc: 'Lock any object on the canvas to prevent accidental edits during a session. Unlock at any time.',
    tags: ['Selection Lock'],
  },
  {
    icon: History,
    title: 'Undo / Redo',
    desc: 'Full per-session undo and redo history. Step back through every action, even in a collaborative session.',
    tags: ['History Stack'],
  },
  {
    icon: Sun,
    title: 'Light & Dark Mode',
    desc: 'Switch between light and dark themes at any time. The theme applies globally across all pages.',
    tags: ['Theme Toggle'],
  },
];

const FeaturesPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
      <ThemeToggle />
      <Navigation />

      <main className="flex-1 pt-28 pb-20">
        {/* Hero */}
        <section className="text-center px-4 mb-16">
          <div className="inline-flex items-center px-4 py-2 rounded-full border border-border/50 bg-muted mb-6 text-sm text-muted-foreground">
            Everything actually built and working
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter mb-5">
            What <span className="gradient-text">Aakrity</span> offers
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            No marketing fluff. These are the features that are live and usable right now
            in every room on the platform.
          </p>
        </section>

        {/* Feature Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc, tags }) => (
              <div key={title} className="rounded-3xl border border-border bg-card p-7 hover-lift">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-foreground/70" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{desc}</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <span key={t} className="px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center mt-20 px-4">
          <h2 className="text-3xl font-black mb-4">Ready to try it?</h2>
          <p className="text-muted-foreground mb-8">Create an account and open a room in under 30 seconds.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/register" className="px-8 py-3 font-semibold bg-primary text-primary-foreground rounded-full hover:opacity-90 transition btn-metallic">
              Get Started Free
            </Link>
            <Link to="/about" className="px-8 py-3 font-semibold border border-border rounded-full hover:bg-muted transition-colors">
              Learn More
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/50 flex items-center justify-center gap-3">
        <span>© {new Date().getFullYear()} Aakrity</span>
        <span className="w-1 h-1 rounded-full bg-border/50"></span>
        <Link to="/" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
          <Home className="w-3 h-3" />
          Home
        </Link>
        <span className="w-1 h-1 rounded-full bg-border/50"></span>
        <Link to="/contact" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
          <Phone className="w-3 h-3" />
          Contact
        </Link>
      </footer>
    </div>
  );
};

export default FeaturesPage;