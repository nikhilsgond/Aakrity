// src/components/canvas/UsersList.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Users, Wifi, WifiOff } from 'lucide-react';

const UsersList = ({ users, currentUserId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debug: log users whenever they change
  useEffect(() => {
    console.log('UsersList received users:', Array.from(users.values()));
  }, [users]);

  const userArray = Array.from(users.values());
  const onlineCount = userArray.filter(u => u.isActive !== false).length;

  return (
    <div className="absolute top-20 right-4 z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg hover:bg-muted transition-colors flex items-center gap-2"
      >
        <Users size={18} />
        <span className="text-sm font-medium">{userArray.length}</span>
        {onlineCount > 0 && (
          <div className="flex -space-x-1 ml-1">
            {userArray.slice(0, 3).map((user) => (
              <div
                key={user.id}
                className="w-5 h-5 rounded-full border-2 border-card flex items-center justify-center text-[10px] text-white font-medium"
                style={{ backgroundColor: user.color || '#6B7280' }}
                title={user.name}
              >
                {user.name?.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-3 border-b border-border bg-muted/30">
            <h3 className="font-semibold flex items-center justify-between">
              <span>Users in room</span>
              <span className="text-xs text-muted-foreground">{onlineCount} online</span>
            </h3>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {userArray.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No users connected
              </div>
            ) : (
              userArray.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium shadow-sm flex-shrink-0"
                    style={{ backgroundColor: user.color || '#6B7280' }}
                  >
                    {user.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.name || 'Anonymous'}
                      {user.id === currentUserId && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {user.isActive !== false ? (
                        <>
                          <Wifi size={12} className="text-green-500" />
                          <span className="text-xs text-green-500">Active</span>
                        </>
                      ) : (
                        <>
                          <WifiOff size={12} className="text-gray-400" />
                          <span className="text-xs text-gray-400">Inactive</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className={`w-2 h-2 rounded-full ${user.isActive !== false ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                </div>
              ))
            )}
          </div>
          
          <div className="p-2 border-t border-border bg-muted/30">
            <button
              onClick={() => {
                // Share/Invite functionality
                navigator.clipboard?.writeText(window.location.href);
                alert('Room link copied to clipboard!');
              }}
              className="w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Users size={14} />
              Copy Invite Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersList;