import ScrollReveal from '@shared/ui/ScrollReveal';

const CollaborationSection = () => {
  const features = [
    {
      icon: 'fa-bolt',
      title: 'Instant Sync',
      description: 'Changes appear for everyone instantly — draw a shape and your teammate sees it in real-time.'
    },
    {
      icon: 'fa-comments',
      title: 'Built-in Chat',
      description: 'Text chat panel directly in the room. Send messages, coordinate live, without leaving the canvas.'
    },
    {
      icon: 'fa-history',
      title: 'Undo / Redo History',
      description: 'Every action is tracked. Undo and redo your own changes at any time during the session.'
    }
  ]

  return (
    <section className="py-32 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <ScrollReveal direction="right">
          <div>
              <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-8">
                <span className="block">Real-time</span>
                <span className="block text-muted-foreground">collaboration</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-10">
                Work together seamlessly with your team. See each other's cursors move in real-time, chat while you draw, and never worry about losing your work.
              </p>
              
              <div className="space-y-8">
                {features.map((feature, index) => (
                  <ScrollReveal key={index} delay={index * 0.1} direction="up">
                  <div className="flex items-start space-x-5 hover:bg-muted/50 p-4 rounded-xl transition-colors">
                      <div className="w-14 h-14 rounded-xl border-2 border-border flex items-center justify-center flex-shrink-0">
                        <i className={`fas ${feature.icon} text-2xl`}></i>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                        <p className="text-muted-foreground">{feature.description}</p>
                      </div>
                  </div>
                  </ScrollReveal>
                ))}
              </div>
          </div>
          </ScrollReveal>

          {/* Collaboration Visualization */}
          <ScrollReveal direction="left">
          <div className="relative">
            <div className="rounded-3xl overflow-hidden border-2 border-border shadow-2xl hover-lift">
              <div className="aspect-video canvas-grid bg-muted relative flex items-center justify-center">
                <div className="text-center p-10">
                  <div className="w-24 h-24 rounded-full border-4 border-border flex items-center justify-center mx-auto mb-8 animate-float">
                    <i className="fas fa-comments text-4xl text-muted-foreground"></i>
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Live Collaboration Demo</h3>
                  <p className="text-muted-foreground">See how teams collaborate in real-time on Aakrity</p>
                </div>
              </div>
            </div>
            
            {/* Floating user avatars */}
            <div className="absolute -top-6 -left-6 w-12 h-12 rounded-full bg-blue-500 border-4 border-background animate-float"></div>
            <div className="absolute -bottom-6 -right-6 w-10 h-10 rounded-full bg-red-500 border-4 border-background animate-float" style={{animationDelay: '1s'}}></div>
            <div className="absolute -top-8 right-8 w-8 h-8 rounded-full bg-green-500 border-4 border-background animate-float" style={{animationDelay: '2s'}}></div>
          </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}

export default CollaborationSection