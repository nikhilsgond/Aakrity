// src/components/panels/ChatWidget.jsx
import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '@app/state/uiStore';
import  useCollaborationStore  from '@features/room/state/collaborationStore';
import { MessageCircle, X, Send, User } from 'lucide-react';

const ChatWidget = ({ roomId, userId, username }) => {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  const { isChatOpen, toggleChat } = useUIStore();
  const { 
    chatMessages, 
    unreadCount, 
    sendChatMessage,
    clearUnreadCount,
    users,
    isConnected
  } = useCollaborationStore();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isChatOpen) {
      scrollToBottom();
    }
  }, [chatMessages, isChatOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isChatOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isChatOpen]);

  const handleSendMessage = () => {
    if (message.trim() && isConnected) {
      sendChatMessage({
        userId,
        username,
        message: message.trim(),
        timestamp: Date.now()
      });
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleOpenChat = () => {
    if (!isChatOpen) {
      clearUnreadCount();
    }
    toggleChat();
  };

  // Get user color from store
  const getUserColor = (msgUserId) => {
    const user = users.get(msgUserId);
    return user?.color || '#6B7280';
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups = [];
    let currentDate = null;
    
    chatMessages.forEach((msg) => {
      const msgDate = new Date(msg.timestamp).toDateString();
      if (msgDate !== currentDate) {
        groups.push({ type: 'date', date: msgDate });
        currentDate = msgDate;
      }
      groups.push({ type: 'message', ...msg });
    });
    
    return groups;
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 select-none">
      {/* Closed State */}
      {!isChatOpen && (
        <button
          onClick={handleOpenChat}
          className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center relative hover:scale-105 transition-transform"
          title="Open chat"
        >
          <MessageCircle className="w-5 h-5" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-xs rounded-full flex items-center justify-center text-white font-bold animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
          {!isConnected && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gray-400 rounded-full border-2 border-background" />
          )}
          {isConnected && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
          )}
        </button>
      )}

      {/* Open State */}
      {isChatOpen && (
        <div className="w-80 h-96 bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Chat</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span>{users.size} online</span>
              </div>
            </div>
            <button
              onClick={handleOpenChat}
              className="p-1 rounded hover:bg-muted transition-colors"
              title="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto panel-scrollbar bg-background/50">
            <div className="space-y-4">
              {chatMessages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1">Start the conversation!</p>
                </div>
              ) : (
                groupMessagesByDate().map((item, index) => {
                  if (item.type === 'date') {
                    return (
                      <div key={`date-${index}`} className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-border"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="px-2 bg-card text-muted-foreground">
                            {new Date(item.date).toLocaleDateString([], { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  const isOwnMessage = item.userId === userId;
                  
                  return (
                    <div
                      key={item.id || index}
                      className={`flex gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                    >
                      {!isOwnMessage && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-medium flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: getUserColor(item.userId) }}
                          title={item.username}
                        >
                          {item.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      
                      <div className={`flex-1 max-w-[75%] ${isOwnMessage ? 'items-end' : ''}`}>
                        {!isOwnMessage && (
                          <div className="flex items-baseline gap-2 mb-1">
                            <p className="text-xs font-medium">
                              {item.username}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(item.timestamp)}
                            </p>
                          </div>
                        )}
                        
                        <div
                          className={`p-2 rounded-lg ${
                            isOwnMessage
                              ? 'bg-primary text-primary-foreground rounded-br-none'
                              : 'bg-muted rounded-tl-none'
                          } break-words text-sm`}
                        >
                          {item.content}
                        </div>
                        
                        {isOwnMessage && (
                          <p className="text-xs text-muted-foreground mt-1 text-right">
                            {formatTime(item.timestamp)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Connection Warning */}
          {!isConnected && (
            <div className="px-4 py-2 bg-yellow-500/10 border-y border-yellow-500/20">
              <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                Reconnecting...
              </p>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-border bg-card">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isConnected ? "Type a message..." : "Connecting..."}
                disabled={!isConnected}
                className="flex-1 p-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSendMessage}
                className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send message"
                disabled={!message.trim() || !isConnected}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;