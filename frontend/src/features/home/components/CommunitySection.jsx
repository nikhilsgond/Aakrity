import { Link } from 'react-router-dom';
import ScrollReveal from '@shared/ui/ScrollReveal';

const useCases = [
  {
    icon: 'fa-users',
    color: 'bg-blue-500/10 text-blue-500',
    title: 'Group Projects',
    description:
      'Plan and sketch ideas together in real-time. Assign zones on the canvas, draw diagrams, and never step on each other\'s work.',
  },
  {
    icon: 'fa-chalkboard-teacher',
    color: 'bg-green-500/10 text-green-500',
    title: 'Study Sessions',
    description:
      'Build mind maps, flowcharts, and notes together while studying. See your classmate\'s cursor move as they explain concepts live.',
  },
  {
    icon: 'fa-drafting-compass',
    color: 'bg-purple-500/10 text-purple-500',
    title: 'Design Reviews',
    description:
      'Drop wireframes or sketches on the canvas, annotate them with shapes and sticky notes, and discuss changes instantly.',
  },
];

const CommunitySection = () => {
  return (
    <section id="features" className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 canvas-grid opacity-10"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <ScrollReveal className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6">Built for Collaboration</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you&apos;re working on a group project, studying, or reviewing designs — Aakrity has you covered.
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-8">
          {useCases.map((item, index) => (
            <ScrollReveal key={index} delay={index * 0.08} direction="up">
            <div className="p-8 rounded-3xl glass hover-lift h-full">
                <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center mb-6`}>
                  <i className={`fas ${item.icon} text-2xl`}></i>
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
            </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal className="text-center mt-14" delay={0.15}>
          <Link
            to="/register"
            className="inline-flex items-center space-x-3 px-8 py-4 font-semibold bg-primary text-primary-foreground rounded-full hover:opacity-90 transition btn-metallic"
          >
            <span>Create a room now</span>
            <i className="fas fa-arrow-right"></i>
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default CommunitySection