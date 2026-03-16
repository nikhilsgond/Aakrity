import { Link } from 'react-router-dom';

const Footer = () => {
  const productLinks = [
    { label: 'Home', to: '/' },
    { label: 'Features', to: '/features' },
    { label: 'About', to: '/about' },
    { label: 'Contact', to: '/contact' },
  ];
  const authLinks = [
    { label: 'Sign In', to: '/login' },
    { label: 'Register', to: '/register' },
  ];
  const projectLinks = [
    { label: 'GitHub', href: 'https://github.com/' },
    { label: 'Documentation', href: '#' },
  ];

  return (
    <footer className="py-16 border-t border-border bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-5 gap-12">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <i className="fas fa-pen-nib text-primary-foreground"></i>
              </div>
              <span className="text-2xl font-black">Aakrity</span>
            </div>
            <p className="text-muted-foreground max-w-md">
              A real-time collaborative whiteboard for teams. Draw shapes, add sticky notes, connect ideas, and see everyone live.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-6">Pages</h3>
            <ul className="space-y-4">
              {productLinks.map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="text-muted-foreground hover:text-foreground transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-6">Account</h3>
            <ul className="space-y-4">
              {authLinks.map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="text-muted-foreground hover:text-foreground transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-6">Project</h3>
            <ul className="space-y-4">
              {projectLinks.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">{label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-muted-foreground">© {new Date().getFullYear()} Aakrity</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            <a href="https://github.com/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer