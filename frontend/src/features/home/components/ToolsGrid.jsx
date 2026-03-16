import ScrollReveal from '@shared/ui/ScrollReveal';

const ToolsGrid = () => {
  const tools = [
    {
      icon: 'fa-pencil-alt',
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10 dark:bg-amber-500/5',
      title: 'Freehand Drawing',
      description: 'Draw freely with a smooth pencil tool. Adjust stroke width and color, then erase with precision.',
      tags: ['Pencil', 'Eraser']
    },
    {
      icon: 'fa-shapes',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10 dark:bg-blue-500/5',
      title: 'Smart Shapes',
      description: 'Rectangles, circles, triangles, diamonds, and more — with fill, stroke, and opacity controls.',
      tags: ['Auto-connect', 'Snapping']
    },
    {
      icon: 'fa-project-diagram',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10 dark:bg-green-500/5',
      title: 'Connectors',
      description: 'Link shapes with smart connectors that auto-route. Straight, curved, or elbow-style paths.',
      tags: ['Auto-route', 'Arrows']
    },
    {
      icon: 'fa-sticky-note',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10 dark:bg-yellow-500/5',
      title: 'Sticky Notes',
      description: '12 colour palettes. Click to place, double-click to edit. Bold & italic formatting built-in.',
      tags: ['12 Colors', 'Rich Text']
    },
    {
      icon: 'fa-font',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10 dark:bg-purple-500/5',
      title: 'Text Tool',
      description: 'Add text anywhere on the canvas with flexible sizing, alignment, and inline formatting.',
      tags: ['Bold', 'Italic']
    },
    {
      icon: 'fa-history',
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10 dark:bg-rose-500/5',
      title: 'History & Undo',
      description: 'Full undo / redo history across every action. Never lose work — even in collaborative sessions.',
      tags: ['Undo / Redo', 'Per-session']
    }
  ]

  return (
    <section className="py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6">What You Get</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Every tool actually built and working — nothing fake, nothing promised</p>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tools.map((tool, index) => (
            <ScrollReveal key={index} delay={index * 0.07} direction="up">
              <div className="p-8 rounded-3xl border border-border hover-lift h-full">
                <div className={`w-14 h-14 rounded-2xl ${tool.bgColor} mb-6 flex items-center justify-center`}>
                  <i className={`fas ${tool.icon} text-2xl ${tool.color}`}></i>
                </div>
                <h3 className="text-xl font-bold mb-4">{tool.title}</h3>
                <p className="text-muted-foreground mb-6">{tool.description}</p>
                <div className="flex flex-wrap gap-2">
                  {tool.tags.map((tag, tagIndex) => (
                    <span key={tagIndex} className="px-3 py-1 text-xs rounded-full bg-muted">{tag}</span>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ToolsGrid