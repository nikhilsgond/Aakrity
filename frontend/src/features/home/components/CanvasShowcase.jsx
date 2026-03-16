import React, { useEffect, useState } from 'react'
import ScrollReveal from '@shared/ui/ScrollReveal'

const CanvasShowcase = () => {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const getParallaxStyle = (speed) => ({
    transform: `translateY(${scrollY * speed * -1}px)`
  })

  return (
    <section className="w-screen min-h-screen relative bg-muted/20 border-t border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <ScrollReveal className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6">Professional Canvas</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Everything you need for visual collaboration in one workspace</p>
        </ScrollReveal>
      </div>

      {/* Full Screen Canvas Area */}
      <div className="relative w-full h-screen canvas-grid">
        {/* Left Toolbar */}
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
          
          <div className="glass rounded-2xl p-2 shadow-2xl">
            <div className="space-y-2">
              {[
                { icon: 'fa-mouse-pointer', tooltip: 'Select (V)' },
                { icon: 'fa-hand', tooltip: 'Hand (H)' },
                { icon: 'fa-pen', tooltip: 'Pen (P)' },
              ].map((tool, i) => (
                <div key={i} className="tooltip">
                  <button className="tool-glow w-11 h-11 rounded-xl border border-border flex items-center justify-center transition-all">
                    <i className={`fas ${tool.icon}`}></i>
                  </button>
                  <div className="tooltip-content">{tool.tooltip}</div>
                </div>
              ))}

              <div className="h-px bg-border my-2"></div>

              {[
                { icon: 'fa-shapes', tooltip: 'Shapes (S)' },
                { icon: 'fa-minus', tooltip: 'Line (L)' },
                { icon: 'fa-font', tooltip: 'Text (T)' },
                { icon: 'fa-sticky-note', tooltip: 'Sticky Note (N)' },
              ].map((tool, i) => (
                <div key={i} className="tooltip">
                  <button className="tool-glow w-11 h-11 rounded-xl border border-border flex items-center justify-center">
                    <i className={`fas ${tool.icon}`}></i>
                  </button>
                  <div className="tooltip-content">{tool.tooltip}</div>
                </div>
              ))}

              <div className="h-px bg-border my-2"></div>

              {[
                { icon: 'fa-eraser', tooltip: 'Eraser (E)' },
                { icon: 'fa-layer-group', tooltip: 'Layers (Ctrl+L)' },
              ].map((tool, i) => (
                <div key={i} className="tooltip">
                  <button className="tool-glow w-11 h-11 rounded-xl border border-border flex items-center justify-center">
                    <i className={`fas ${tool.icon}`}></i>
                  </button>
                  <div className="tooltip-content">{tool.tooltip}</div>
                </div>
              ))}

              <div className="h-px bg-border my-2"></div>

              <div className="space-y-1">
                <button className="tool-glow w-8 h-11 rounded-lg border border-border flex items-center justify-center mx-auto">
                  <i className="fas fa-undo text-sm"></i>
                </button>
                <button className="tool-glow w-8 h-11 rounded-lg border border-border flex items-center justify-center mx-auto">
                  <i className="fas fa-redo text-sm"></i>
                </button>
              </div>

              <button className="tool-glow w-11 h-11 rounded-xl border border-border flex items-center justify-center mt-2">
                <i className="fas fa-ellipsis-h"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Toolbar */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="glass rounded-full px-4 py-2 flex items-center space-x-4 shadow-xl">
            <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
              <i className="fas fa-search-minus"></i>
            </button>
            <span className="font-mono text-sm">100%</span>
            <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
              <i className="fas fa-search-plus"></i>
            </button>
            <div className="w-px h-4 bg-border"></div>
            <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
              <i className="fas fa-th"></i>
            </button>
            <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
              <i className="fas fa-lock"></i>
            </button>
          </div>
        </div>



        {/* Canvas Content */}
        <div className="absolute inset-0 p-4 sm:p-8 md:p-16">
          {/* Wireframe Card */}
          <div
            className="absolute top-20 left-20 sm:left-40 w-64 sm:w-80 glass rounded-2xl border-2 border-border p-4"
            style={getParallaxStyle(0.12)}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold">App Wireframe</div>
              <div className="text-xs px-2 py-1 bg-muted rounded">v2.1</div>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[0, 0.2, 0.4, 0.6].map((delay, i) => (
                <div
                  key={i}
                  className="h-6 shimmer-bg rounded animate-shimmer"
                  style={{ animationDelay: `${delay}s` }}
                ></div>
              ))}
            </div>
            <div className="h-32 shimmer-bg rounded-lg mb-3 animate-shimmer" style={{ animationDelay: '0.8s' }}></div>
            <div className="flex justify-between">
              {[1, 1.2, 1.4].map((delay, i) => (
                <div
                  key={i}
                  className="w-1/4 h-8 shimmer-bg rounded animate-shimmer"
                  style={{ animationDelay: `${delay}s` }}
                ></div>
              ))}
            </div>
          </div>

          {/* Mind Map */}
          <div
            className="absolute top-40 right-40 hidden md:block"
            style={getParallaxStyle(0.15)}
          >
            <div className="relative w-64 h-64">
              {/* SVG connecting lines — endpoints sit exactly on each circle's border */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 256 256">
                {/* Goals (48,16) r=32: start=(100,89) end=(67,42) */}
                <line x1="100" y1="89" x2="67" y2="42" stroke="hsl(var(--foreground) / 0.25)" strokeWidth="2" />
                {/* Team (208,16) r=32: start=(156,89) end=(189,42) */}
                <line x1="156" y1="89" x2="189" y2="42" stroke="hsl(var(--foreground) / 0.25)" strokeWidth="2" />
                {/* Roadmap (48,240) r=32: start=(100,167) end=(67,214) */}
                <line x1="100" y1="167" x2="67" y2="214" stroke="hsl(var(--foreground) / 0.25)" strokeWidth="2" />
                {/* Launch (208,240) r=32: start=(156,167) end=(189,214) */}
                <line x1="156" y1="167" x2="189" y2="214" stroke="hsl(var(--foreground) / 0.25)" strokeWidth="2" />
              </svg>
              {/* Center node */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-4 border-border flex items-center justify-center z-10 bg-card/80">
                <span className="font-bold text-sm">Strategy</span>
              </div>
              {[
                { position: 'top-[-1rem] left-[1rem]', label: 'Goals' },
                { position: 'top-[-1rem] right-[1rem]', label: 'Team' },
                { position: 'bottom-[-1rem] left-[1rem]', label: 'Roadmap' },
                { position: 'bottom-[-1rem] right-[1rem]', label: 'Launch' },
              ].map((node, i) => (
                <div key={i} className={`absolute ${node.position} w-16 h-16 rounded-full border-2 border-border flex items-center justify-center z-10 bg-card/80`}>
                  <span className="text-xs font-medium">{node.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Flow Diagram */}
          <div
            className="absolute bottom-40 left-40 hidden lg:block"
            style={getParallaxStyle(0.2)}
          >
            <svg viewBox="0 0 448 72" width="448" height="72" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker id="arrowFlow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="hsl(var(--muted-foreground))" />
                </marker>
              </defs>
              {/* Box 1 — Research */}
              <rect x="4" y="14" width="96" height="44" rx="8" stroke="hsl(var(--border))" strokeWidth="1.5" fill="hsl(var(--card))"/>
              <text x="52" y="41" textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="600" fill="hsl(var(--foreground))">Research</text>
              {/* Arrow 1 */}
              <line x1="100" y1="36" x2="118" y2="36" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" markerEnd="url(#arrowFlow)"/>
              {/* Box 2 — Design */}
              <rect x="120" y="14" width="96" height="44" rx="8" stroke="hsl(var(--border))" strokeWidth="1.5" fill="hsl(var(--card))"/>
              <text x="168" y="41" textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="600" fill="hsl(var(--foreground))">Design</text>
              {/* Arrow 2 */}
              <line x1="216" y1="36" x2="234" y2="36" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" markerEnd="url(#arrowFlow)"/>
              {/* Box 3 — Build */}
              <rect x="236" y="14" width="96" height="44" rx="8" stroke="hsl(var(--border))" strokeWidth="1.5" fill="hsl(var(--card))"/>
              <text x="284" y="41" textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="600" fill="hsl(var(--foreground))">Build</text>
              {/* Arrow 3 */}
              <line x1="332" y1="36" x2="350" y2="36" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" markerEnd="url(#arrowFlow)"/>
              {/* Box 4 — Ship (filled) */}
              <rect x="352" y="14" width="92" height="44" rx="8" fill="hsl(var(--primary))"/>
              <text x="398" y="41" textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="600" fill="hsl(var(--primary-foreground))">Ship</text>
            </svg>
          </div>

          {/* Sticky Notes — muted desaturated pastels */}
          <div
            className="absolute bottom-20 right-20 sm:right-40"
            style={getParallaxStyle(0.12)}
          >
            <div className="relative">
              <div className="w-36 h-36 rounded-lg p-4 shadow-lg" style={{background:'#E8DCC8'}}>
                <div className="font-bold mb-2 text-sm" style={{color:'#1a1a1a'}}>Ideas</div>
                <ul className="text-xs space-y-1" style={{color:'#1a1a1a'}}>
                  <li>• Dark mode</li>
                  <li>• Export options</li>
                  <li>• Templates</li>
                </ul>
              </div>
              <div className="absolute -top-[50%] -right-[50%] w-32 h-32 rounded-lg p-4 shadow-lg transform -rotate-2" style={{background:'#DEB8B4'}}>
                <div className="font-bold mb-2 text-sm" style={{color:'#1a1a1a'}}>To Do</div>
                <ul className="text-xs space-y-1" style={{color:'#1a1a1a'}}>
                  <li>• User testing</li>
                  <li>• Bug fixes</li>
                </ul>
              </div>
              <div className="absolute -bottom-[50%] -left-[50%] w-32 h-32 rounded-lg p-4 shadow-lg transform rotate-6" style={{background:'#B8CCBA'}}>
                <div className="font-bold mb-2 text-sm" style={{color:'#1a1a1a'}}>Questions</div>
                <ul className="text-xs" style={{color:'#1a1a1a'}}>
                  <li>• Timeline?</li>
                  <li>• Budget?</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Animated Cursors */}
          <div className="cursor-on-wireframe absolute top-24 left-64 animate-cursor-wireframe">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3L10 20L13 13L20 10L3 3Z" fill="#3B82F6" />
              <path d="M13 13L10 20L3 3L20 10L13 13Z" stroke="white" strokeWidth="1" />
            </svg>
            <div className="absolute -top-8 left-0 px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
              Alex
            </div>
          </div>

          <div className="animate-cursor-mindmap cursor-mindmap absolute top-32 right-64  hidden md:block">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3L10 20L13 13L20 10L3 3Z" fill="#EF4444" />
              <path d="M13 13L10 20L3 3L20 10L13 13Z" stroke="white" strokeWidth="1" />
            </svg>
            <div className="absolute -top-8 right-0 px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
              Sarah
            </div>
          </div>

          <div className="cursor-on-flow absolute bottom-[420px] left-52 animate-cursor-flow hidden lg:block">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3L10 20L13 13L20 10L3 3Z" fill="#10B981" />
              <path d="M13 13L10 20L3 3L20 10L13 13Z" stroke="white" strokeWidth="1" />
            </svg>
            <div className="absolute -top-8 left-0 px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
              Mike
            </div>
          </div>

          <div className="cursor-on-sticky absolute bottom-64 right-52 animate-cursor-sticky ">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3L10 20L13 13L20 10L3 3Z" fill="#F59E0B" />
              <path d="M13 13L10 20L3 3L20 10L13 13Z" stroke="white" strokeWidth="1" />
            </svg>
            <div className="absolute -top-8 right-0 px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
              Emma
            </div>
          </div>
        </div>



        {/* Bottom Status Bar */}
        <div className="absolute bottom-0 left-0 right-0 glass border-t border-border p-4 flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Auto-saving</span>
            </div>
            <div className="flex items-center space-x-2">
              <i className="fas fa-expand-alt text-muted-foreground"></i>
              <span className="font-mono text-sm">1920×1080</span>
            </div>
            <div className="flex items-center space-x-2">
              <i className="fas fa-cube text-muted-foreground"></i>
              <span className="font-mono text-sm">24 objects</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
              <i className="fas fa-history"></i>
            </button>
            <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
              <i className="fas fa-download"></i>
            </button>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition">
              Share
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CanvasShowcase