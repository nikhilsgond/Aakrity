// src/components/panels/TopBar.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@app/state/uiStore';
import useCollaborationStore from '@features/room/state/collaborationStore';
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
  Users,
  LogOut,
} from 'lucide-react';

const getUserInitials = (name = '') => {
  const cleaned = String(name || '').trim();
  if (!cleaned) {
    return '?';
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  const first = parts[0]?.[0] || '';
  const last = parts[parts.length - 1]?.[0] || '';
  return `${first}${last}`.toUpperCase();
};

const UserAvatar = ({ user, sizeClass, textClass, className = '' }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const hasAvatar = Boolean(user?.avatarUrl) && !imageFailed;

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${className}`}
      style={hasAvatar ? undefined : { backgroundColor: user?.color || '#6b7280' }}
      title={user?.name || 'User'}
    >
      {hasAvatar ? (
        <img
          src={user.avatarUrl}
          alt={`${user?.name || 'User'} avatar`}
          className="w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={`${textClass} font-bold text-white select-none`}>
          {getUserInitials(user?.name)}
        </span>
      )}
    </div>
  );
};

const TopBar = ({
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onSetZoomPercent,
  onResetViewport,
  onExport,
  onShare,
  canUndo,
  canRedo,
  zoomLevel,
  activeTool,
  onToolChange,
  collaborationStatus,
  sendOperation
}) => {
  const navigate = useNavigate();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState('');
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInput, setZoomInput] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const zoomInputRef = useRef(null);
  const usersRef = useRef(null);

  const { boardTitle, setBoardTitle } = useUIStore();
  const { users, isConnected, titleEditLock, currentUser } = useCollaborationStore();

  // Close users dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (usersRef.current && !usersRef.current.contains(e.target)) setShowUsers(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Format zoom percentage
  const zoomPercentage = Math.round(zoomLevel * 100);

  // Update zoom input when zoom changes
  useEffect(() => {
    if (!isEditingZoom) {
      setZoomInput(zoomPercentage.toString());
    }
  }, [zoomPercentage, isEditingZoom]);

  // Focus zoom input when editing starts
  useEffect(() => {
    if (isEditingZoom && zoomInputRef.current) {
      zoomInputRef.current.focus();
      zoomInputRef.current.select();
    }
  }, [isEditingZoom]);

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    // Only broadcast if the title actually changed
    if (localTitle !== boardTitle) {
      setBoardTitle(localTitle);
      // Broadcast title update directly to ensure remote sync
      if (sendOperation) {
        sendOperation({ type: 'title:update', title: localTitle, timestamp: Date.now() });
      }
    }
    // Release title edit lock
    if (sendOperation) {
      sendOperation({ type: 'title:editing:stop', timestamp: Date.now() });
    }
  };

  const handleTitleStartEdit = () => {
    // Check if another user is editing the title
    const isTitleLockedByOther = titleEditLock && currentUser && titleEditLock.userId !== currentUser.id;
    if (isTitleLockedByOther) return; // Soft lock — don't allow editing
    setLocalTitle(boardTitle);
    setIsEditingTitle(true);
    // Broadcast title edit lock
    if (sendOperation) {
      sendOperation({ type: 'title:editing:start', timestamp: Date.now() });
    }
  };

  const handleZoomClick = () => {
    setIsEditingZoom(true);
  };

  const handleZoomBlur = () => {
    commitZoomChange();
  };

  const handleZoomKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitZoomChange();
    } else if (e.key === 'Escape') {
      setZoomInput(zoomPercentage.toString());
      setIsEditingZoom(false);
    }
  };

  const commitZoomChange = () => {
    const value = zoomInput.trim();
    if (value === '') {
      setZoomInput(zoomPercentage.toString());
      setIsEditingZoom(false);
      return;
    }

    const parsed = parseFloat(value);
    
    if (!isNaN(parsed) && onSetZoomPercent) {
      const clampedPercent = onSetZoomPercent(parsed);
      setZoomInput(clampedPercent.toString());
    } else {
      setZoomInput(zoomPercentage.toString());
    }
    
    setIsEditingZoom(false);
  };

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 h-12 px-4 flex items-center gap-3 bg-card border border-border rounded-full shadow-lg z-50 backdrop-blur-sm bg-opacity-95 select-none">
      {/* Left Section - History Controls */}
      <div className="flex items-center gap-2">
        <button
          className={`p-2 rounded-full hover:bg-muted transition-colors relative ${
            !canUndo ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title="Undo (Ctrl+Z)"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          className={`p-2 rounded-full hover:bg-muted transition-colors ${
            !canRedo ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title="Redo (Ctrl+Shift+Z)"
          onClick={onRedo}
          disabled={!canRedo}
        >
          <Redo2 className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-border mx-1"></div>
      </div>

      {/* Center Section - Board Title */}
      <div className="flex-1 min-w-[120px] max-w-[300px]">
        {isEditingTitle ? (
          <input
            type="text"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') {
                setLocalTitle(boardTitle);
                setIsEditingTitle(false);
              }
            }}
            className="w-full px-3 py-1 bg-transparent border-b border-primary focus:outline-none text-sm"
            autoFocus
            maxLength={50}
          />
        ) : (
          <h1
            onClick={handleTitleStartEdit}
            className={`text-sm font-medium truncate px-3 py-1 rounded transition-colors ${
              titleEditLock && currentUser && titleEditLock.userId !== currentUser.id
                ? 'cursor-not-allowed opacity-60'
                : 'cursor-pointer hover:bg-muted'
            }`}
            title={
              titleEditLock && currentUser && titleEditLock.userId !== currentUser.id
                ? `Being edited by ${titleEditLock.username || 'another user'}`
                : 'Click to edit title'
            }
          >
            {boardTitle || 'Untitled Board'}
            {titleEditLock && currentUser && titleEditLock.userId !== currentUser.id && (
              <span className="ml-1 text-xs opacity-50">✏️</span>
            )}
          </h1>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1">

        {/* Connection dot */}
        <div
          className={`w-1.5 h-1.5 rounded-full mx-1.5 flex-shrink-0 transition-colors ${
            isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
          }`}
          title={isConnected ? 'Connected' : 'Reconnecting…'}
        />

        <div className="w-px h-5 bg-border" />

        {/* Zoom group */}
        <button
          onClick={onZoomOut}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title="Zoom Out (Ctrl+-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <div className="min-w-[46px] text-center">
          {isEditingZoom ? (
            <input
              ref={zoomInputRef}
              type="text"
              value={zoomInput}
              onChange={(e) => setZoomInput(e.target.value)}
              onBlur={handleZoomBlur}
              onKeyDown={handleZoomKeyDown}
              className="w-[46px] text-xs font-medium px-1 py-0.5 bg-transparent border-b border-primary focus:outline-none text-center"
            />
          ) : (
            <button
              className="text-xs font-medium px-1.5 py-1 rounded hover:bg-muted transition-colors w-full"
              onClick={handleZoomClick}
              title="Click to set zoom"
            >
              {zoomPercentage}%
            </button>
          )}
        </div>

        <button
          onClick={onZoomIn}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title="Zoom In (Ctrl+=)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-border" />

        {/* Reset view */}
        <button
          onClick={onResetViewport}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title="Reset View (Ctrl+0)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Export */}
        <button
          onClick={onExport}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title="Export"
        >
          <Download className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-border" />

        {/* Connected users */}
        <div className="relative" ref={usersRef}>
          <button
            onClick={() => setShowUsers(v => !v)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Connected users"
          >
            {/* Avatar stack */}
            <div className="flex -space-x-1.5">
              {Array.from(users.values()).slice(0, 3).map(u => (
                <UserAvatar
                  key={u.id}
                  user={u}
                  sizeClass="w-5 h-5"
                  textClass="text-[9px]"
                  className="border border-card"
                />
              ))}
            </div>
            <span className="text-xs font-medium tabular-nums">{users.size}</span>
          </button>

          {showUsers && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-60 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-[60]">
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {users.size} in room
                </p>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {Array.from(users.values()).map(u => (
                  <div key={u.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors">
                    <UserAvatar
                      user={u}
                      sizeClass="w-7 h-7"
                      textClass="text-xs"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {u.name}
                        {u.isCurrentUser && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                      </p>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      u.isActive !== false ? 'bg-emerald-500' : 'bg-muted-foreground'
                    }`} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Leave */}
        <div className="relative flex items-center">
          {showLeaveConfirm ? (
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2 py-1 shadow-md">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Exit?</span>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="px-2 py-0.5 text-xs font-semibold border border-border rounded hover:bg-muted transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-colors"
              title="Leave room"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;