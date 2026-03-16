import { useState } from 'react'
import ScrollReveal from '@shared/ui/ScrollReveal'

const UserChatSection = () => {
  const [messages, setMessages] = useState([
    { id: 1, user: 'Alex',  color: 'bg-blue-500',   time: '2:30 PM', text: 'What do you think about moving the navigation here?' },
    { id: 2, user: 'Sarah', color: 'bg-red-500',    time: '2:31 PM', text: 'That could work, but we need to consider mobile' },
    { id: 3, user: 'Mike',  color: 'bg-green-500',  time: '2:32 PM', text: 'I\'ll create a separate mobile wireframe' },
    { id: 4, user: 'Emma',  color: 'bg-yellow-500', time: '2:33 PM', text: 'Great idea! Let me add some annotations' },
  ])
  const [newMessage, setNewMessage] = useState('')

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (newMessage.trim()) {
      setMessages([
        ...messages,
        {
          id: messages.length + 1,
          user: 'You',
          color: 'bg-purple-500',
          time: 'Now',
          text: newMessage
        }
      ])
      setNewMessage('')
    }
  }

  const activeUsers = [
    { name: 'Alex',  color: 'bg-blue-500',   online: true },
    { name: 'Sarah', color: 'bg-red-500',    online: true },
    { name: 'Mike',  color: 'bg-green-500',  online: true },
    { name: 'Emma',  color: 'bg-yellow-500', online: true },
    { name: 'James', color: 'bg-slate-500',  online: false },
    { name: 'Lisa',  color: 'bg-pink-500',   online: false },
  ]

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 canvas-grid opacity-10"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <ScrollReveal className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6">Team Chat &amp; Collaboration</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Communicate seamlessly while working together on the canvas</p>
        </ScrollReveal>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Active Users */}
          <ScrollReveal direction="right" className="lg:col-span-1">
            <div className="glass rounded-3xl p-8 border-2 border-border">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <h3 className="text-2xl font-bold">Active Team</h3>
                </div>
                <div className="px-3 py-1 bg-muted text-sm rounded-full">6 members</div>
              </div>
              
              <div className="space-y-4">
                {activeUsers.map((user, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="relative flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full ${user.color} flex items-center justify-center text-white font-bold text-sm`}>
                          {user.name[0]}
                        </div>
                        {user.online && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.online ? 'Connected' : 'Offline'}
                        </div>
                      </div>
                    </div>
                    {user.online && (
                      <button className="px-3 py-1 text-sm border border-border rounded-full hover:bg-border transition-colors">
                        Message
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Chat Interface */}
          <ScrollReveal direction="left" delay={0.1} className="lg:col-span-2">
            <div className="glass rounded-3xl border-2 border-border overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <h3 className="text-2xl font-bold">Design Team Chat</h3>
                </div>
              </div>

              {/* Messages */}
              <div className="h-[500px] overflow-y-auto p-6 space-y-6">
                {messages.map((message) => (
                  <div key={message.id} className="flex space-x-3">
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 ${message.color} flex items-center justify-center text-white font-bold text-xs`}>
                      {message.user[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline space-x-2">
                        <span className="font-medium text-sm">{message.user}</span>
                        <span className="text-xs text-muted-foreground">{message.time}</span>
                      </div>
                      <p className="text-sm mt-1 bg-muted/50 p-3 rounded-xl">{message.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-6 border-t border-border">
                <form onSubmit={handleSendMessage} className="flex space-x-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message here..."
                      className="w-full px-4 py-3 border border-border rounded-full bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-12 h-12 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition flex items-center justify-center"
                  >
                    <i className="fas fa-paper-plane"></i>
                  </button>
                </form>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}

export default UserChatSection