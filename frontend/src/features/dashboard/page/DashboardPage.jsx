import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Loader2, LogOut, PenTool, ArrowRight, Plus, LogIn, DoorOpen, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useUIStore } from '@app/state/uiStore';
import { useAuth } from '@features/auth/context/AuthProvider';
import { apiRequest } from '@shared/lib/apiClient';
import {
  containsUnsafeText,
  readFileAsDataUrl,
  validateImageFile,
  validatePlainText,
  validateRoomId,
} from '@shared/lib/inputValidation';

const EASE = [0.22, 1, 0.36, 1];
const fade = (delay = 0, y = 16) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: EASE },
});

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-purple-500',
  'bg-pink-500', 'bg-amber-500', 'bg-teal-500', 'bg-indigo-500',
];

function getAvatarColor(name) {
  const source = name || 'A';
  const code = [...source].reduce((accumulator, char) => accumulator + char.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function getInitials(name) {
  return (name || 'A')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTimestamp(value) {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Avatar({ name, avatarUrl, className = '' }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Profile'}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`rounded-full flex items-center justify-center text-white font-bold ${getAvatarColor(name)} ${className}`}>
      {getInitials(name)}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const profileRef = useRef(null);
  const avatarInputRef = useRef(null);
  const { theme, setTheme, initTheme } = useUIStore();
  const dark = theme === 'dark';

  const {
    session,
    user,
    profile,
    displayName,
    signOut,
    isLoading,
    uploadProfileAvatar,
  } = useAuth();

  const [dashboardData, setDashboardData] = useState({
    ownedRoom: null,
    joinedRooms: [],
  });
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', password: '', maxMembers: 10 });
  const [joinForm, setJoinForm] = useState({ roomId: '', password: '' });
  const [joinTarget, setJoinTarget] = useState(null);
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState(null);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState(null);

  const ownedRoom = dashboardData.ownedRoom;
  const joinedRooms = dashboardData.joinedRooms || [];

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const loadDashboard = async () => {
    if (!session?.access_token) {
      setDashboardData({ ownedRoom: null, joinedRooms: [] });
      setRoomsLoading(false);
      return;
    }

    setRoomsLoading(true);

    try {
      const payload = await apiRequest('/api/rooms', {
        token: session.access_token,
      });
      setDashboardData({
        ownedRoom: payload.ownedRoom || null,
        joinedRooms: payload.joinedRooms || [],
      });
    } catch (error) {
      toast.error(error.message || 'Failed to load rooms.');
      setDashboardData({ ownedRoom: null, joinedRooms: [] });
    } finally {
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      loadDashboard();
    }
  }, [isLoading, session?.access_token]);

  const handleThemeToggle = () => {
    setTheme(dark ? 'light' : 'dark');
  };

  const handleCreateRoom = async (event) => {
    event.preventDefault();
    setCreateError('');

    const nameError = validatePlainText(createForm.name, {
      label: 'Room name',
      minLength: 2,
      maxLength: 80,
    });

    if (nameError) {
      setCreateError(nameError);
      return;
    }

    if (!createForm.password) {
      setCreateError('Room password is required.');
      return;
    }

    if (containsUnsafeText(createForm.password)) {
      setCreateError('Room password must be plain text only.');
      return;
    }

    if (createForm.password.length < 4) {
      setCreateError('Room password must be at least 4 characters.');
      return;
    }

    setSubmittingCreate(true);

    try {
      const payload = await apiRequest('/api/rooms', {
        method: 'POST',
        token: session.access_token,
        body: {
          name: createForm.name.trim(),
          password: createForm.password,
          maxMembers: Math.max(2, Math.min(50, Number(createForm.maxMembers) || 10)),
        },
      });

      toast.success('Room created successfully.');
      setCreateForm({ name: '', password: '', maxMembers: 10 });
      setCreating(false);
      await loadDashboard();
      navigate(`/room/${payload.room.id}`);
    } catch (error) {
      setCreateError(error.message || 'Failed to create room.');
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleJoinRoom = async (event) => {
    event.preventDefault();
    setJoinError('');

    const roomIdError = validateRoomId(joinForm.roomId);

    if (roomIdError) {
      setJoinError(roomIdError);
      return;
    }

    if (!joinForm.password) {
      setJoinError('Room password is required.');
      return;
    }

    if (containsUnsafeText(joinForm.password)) {
      setJoinError('Room password must be plain text only.');
      return;
    }

    setSubmittingJoin(true);

    try {
      const roomId = joinForm.roomId.trim();
      await apiRequest('/api/rooms/join', {
        method: 'POST',
        token: session.access_token,
        body: {
          roomId,
          password: joinForm.password,
        },
      });
      toast.success('Joined room successfully.');
      setJoining(false);
      setJoinTarget(null);
      setJoinForm({ roomId: '', password: '' });
      await loadDashboard();
      navigate(`/room/${roomId}`);
    } catch (error) {
      setJoinError(error.message || 'Failed to join room.');
    } finally {
      setSubmittingJoin(false);
    }
  };

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const imageError = validateImageFile(file, {
      label: 'Profile image',
    });

    if (imageError) {
      toast.error(imageError);
      return;
    }

    setUploadingAvatar(true);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      await uploadProfileAvatar(dataUrl);
      toast.success('Profile image updated.');
      setProfileOpen(false);
    } catch (error) {
      toast.error(error.message || 'Failed to upload profile image.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const openPasswordJoinForRoom = (room, message = 'Enter the room password to continue.') => {
    setJoinTarget({ id: room.id, name: room.name, role: room.role || 'member' });
    setJoinForm({ roomId: room.id, password: '' });
    setJoinError('');
    setCreating(false);
    setJoining(true);
    toast.info(message);
  };

  const handleOpenRoom = (room) => {
    openPasswordJoinForRoom(room, 'Enter the room password to rejoin.');
  };

  const handleOwnedRoomClick = () => {
    if (!ownedRoom) {
      return;
    }

    openPasswordJoinForRoom({ ...ownedRoom, role: 'owner' }, 'Enter the room password to rejoin your room.');
  };

  const handleJoinAction = () => {
    setJoining((current) => !current);
    setCreating(false);
    setJoinError('');
    setJoinTarget(null);
    setJoinForm((current) => ({ ...current, roomId: '', password: '' }));
  };

  const handleCreateAction = () => {
    setCreating((current) => !current);
    setJoining(false);
    setCreateError('');
    setJoinTarget(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(error.message || 'Failed to sign out.');
    }
  };

  const handleDeleteRoom = async (room) => {
    if (!room || room.role !== 'owner') {
      return;
    }

    setDeletingRoomId(room.id);

    try {
      await apiRequest(`/api/rooms/${room.id}`, {
        method: 'DELETE',
        token: session.access_token,
      });

      if (joinTarget?.id === room.id) {
        setJoinTarget(null);
        setJoinForm({ roomId: '', password: '' });
        setJoining(false);
      }

      toast.success('Room deleted successfully.');
      await loadDashboard();
    } catch (error) {
      toast.error(error.message || 'Failed to delete room.');
    } finally {
      setDeletingRoomId(null);
      setConfirmDeleteRoomId(null);
    }
  };

  const roomCards = useMemo(() => {
    const cards = [];
    const seenRoomIds = new Set();

    if (ownedRoom) {
      cards.push({
        id: ownedRoom.id,
        name: ownedRoom.name,
        role: 'owner',
        timestampLabel: 'Created',
        timestamp: ownedRoom.created_at,
      });
      seenRoomIds.add(ownedRoom.id);
    }

    joinedRooms.forEach((joinedRoom) => {
      if (!joinedRoom?.id || seenRoomIds.has(joinedRoom.id)) {
        return;
      }

      cards.push({
        id: joinedRoom.id,
        name: joinedRoom.name,
        role: 'member',
        timestampLabel: 'Joined',
        timestamp: joinedRoom.membership?.joined_at || joinedRoom.created_at,
      });

      seenRoomIds.add(joinedRoom.id);
    });

    return cards;
  }, [joinedRooms, ownedRoom]);

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 transition placeholder-muted-foreground';
  const actionButtonCls = 'group flex min-h-[74px] w-full items-center justify-between rounded-2xl border border-border/80 bg-card px-5 py-4 text-left transition duration-200 hover:border-1 hover:border-dashed hover:border-primary/80 hover:bg-card hover:shadow-[0_0_0_1px_rgba(255,255,255,0.04)] active:scale-[0.99]';
  const actionIconCls = 'flex h-9 w-9 items-center justify-center rounded-xl bg-muted/70 text-foreground';

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleAvatarFile}
      />

      <header className="sticky top-0 z-50 h-16 px-6 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <PenTool className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-black tracking-tight">Aakrity</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={handleThemeToggle}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((current) => !current)}
              className="w-9 h-9 rounded-full overflow-hidden border border-border flex items-center justify-center"
            >
              <Avatar
                name={displayName}
                avatarUrl={profile?.avatar_url}
                className="w-full h-full text-sm"
              />
            </button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: EASE }}
                  className="absolute right-0 top-12 w-56 rounded-2xl border border-border bg-card shadow-xl p-4 z-50"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar
                      name={displayName}
                      avatarUrl={profile?.avatar_url}
                      className="w-10 h-10 text-sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="w-full py-2 text-xs font-medium border border-border rounded-xl hover:bg-muted transition-colors disabled:opacity-60 mb-2 flex items-center justify-center gap-2"
                  >
                    {uploadingAvatar ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                      </>
                    ) : (
                      'Change profile image'
                    )}
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full py-2 text-xs font-medium border border-border rounded-xl hover:bg-muted transition-colors flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-3 h-3" /> Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <motion.div {...fade(0.05)} className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{getGreeting()}, {(displayName || 'User').split(' ')[0]}</h1>
            <p className="text-sm text-muted-foreground mt-1">Create a room or jump back into one you already joined.</p>
          </div>
          <button
            onClick={loadDashboard}
            className="px-3 py-2 text-xs font-semibold border border-border rounded-xl hover:bg-muted transition-colors"
          >
            Refresh
          </button>
        </motion.div>

        <motion.div {...fade(0.1)} className="grid md:grid-cols-2 gap-4 mb-6">
          {ownedRoom ? (
                <button onClick={handleOwnedRoomClick} className={actionButtonCls}>
              <span className="flex items-center gap-3">
                <span className={actionIconCls}>
                  <DoorOpen className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                      <span className="block text-base font-semibold leading-tight">Your room</span>
                  <span className="block text-sm text-muted-foreground truncate mt-0.5">
                    {ownedRoom.name}
                  </span>
                </span>
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <button onClick={handleCreateAction} className={actionButtonCls}>
              <span className="flex items-center gap-3">
                <span className={actionIconCls}>
                  <Plus className="w-4 h-4" />
                </span>
                <span>
                  <span className="block text-base font-semibold leading-tight">Create room</span>
                  <span className="block text-sm text-muted-foreground mt-0.5">Start a new workspace</span>
                </span>
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          )}

          <button onClick={handleJoinAction} className={actionButtonCls}>
            <span className="flex items-center gap-3">
              <span className={actionIconCls}>
                <LogIn className="w-4 h-4" />
              </span>
              <span>
                <span className="block text-base font-semibold leading-tight">Join room</span>
                <span className="block text-sm text-muted-foreground mt-0.5">Enter with room ID</span>
              </span>
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        </motion.div>

        <AnimatePresence initial={false}>
          {(creating || joining) && (
            <motion.section
              key={creating ? 'create-panel' : 'join-panel'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="rounded-2xl border border-border bg-card p-7 mb-6"
            >
              {creating ? (
                <>
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Create</p>
                    <h2 className="text-xl font-bold mt-2">New room</h2>
                  </div>

                  <form onSubmit={handleCreateRoom} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Room name</label>
                      <input
                        className={inputCls}
                        type="text"
                        value={createForm.name}
                        onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Design sprint"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Room password</label>
                      <input
                        className={inputCls}
                        type="password"
                        value={createForm.password}
                        onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                        placeholder="At least 4 characters"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Max members</label>
                      <input
                        className={inputCls}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={createForm.maxMembers}
                        onChange={(event) => {
                          const numericValue = event.target.value.replace(/\D/g, '');
                          setCreateForm((current) => ({ ...current, maxMembers: numericValue }));
                        }}
                      />
                    </div>
                    {createError && <p className="text-xs text-destructive">{createError}</p>}
                    <button
                      type="submit"
                      disabled={submittingCreate}
                      className="w-full py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition disabled:opacity-60 btn-metallic flex items-center justify-center gap-2"
                    >
                      {submittingCreate ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                        </>
                      ) : (
                        'Create Room'
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Join</p>
                    <h2 className="text-xl font-bold mt-2">Existing room</h2>
                  </div>

                  <form onSubmit={handleJoinRoom} className="space-y-4">
                    {joinTarget ? (
                      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Selected room</p>
                        <p className="mt-1 text-sm font-semibold">{joinTarget.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Room ID: {joinTarget.id}</p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Room ID</label>
                        <input
                          className={inputCls}
                          type="text"
                          value={joinForm.roomId}
                          onChange={(event) => {
                            setJoinTarget(null);
                            setJoinForm((current) => ({ ...current, roomId: event.target.value }));
                          }}
                          placeholder="Paste the room ID"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Room password</label>
                      <input
                        className={inputCls}
                        type="password"
                        value={joinForm.password}
                        onChange={(event) => setJoinForm((current) => ({ ...current, password: event.target.value }))}
                        placeholder="Enter the room password"
                      />
                    </div>
                    {joinError && <p className="text-xs text-destructive">{joinError}</p>}
                    <button
                      type="submit"
                      disabled={submittingJoin}
                      className="w-full py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition disabled:opacity-60 btn-metallic flex items-center justify-center gap-2"
                    >
                      {submittingJoin ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Joining...
                        </>
                      ) : (
                        'Join Room'
                      )}
                    </button>
                  </form>
                </>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        <motion.section {...fade(0.14)} className="rounded-[26px] border border-border bg-card overflow-hidden">
          <div className="px-6 py-5 border-b border-border/80">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Rooms</p>
            <h2 className="text-[28px] font-bold tracking-tight mt-2">Your workspaces</h2>
          </div>

          {roomsLoading ? (
            <div className="min-h-[260px] px-6 py-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading rooms...
            </div>
          ) : roomCards.length === 0 ? (
            <div className="min-h-[260px] text-muted-foreground flex flex-col items-center justify-center text-center px-6 py-14">
              <div className="w-11 h-11 rounded-xl bg-muted/60 flex items-center justify-center mb-4">
                <DoorOpen className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold">No rooms yet</p>
              <p className="text-xs mt-1">Use the action buttons above to create or join a room.</p>
            </div>
          ) : (
            <div className="px-6 py-4 space-y-3">
              {roomCards.map((room, index) => (
                <motion.div
                  key={room.id}
                  {...fade(0.18 + index * 0.03, 10)}
                  className="rounded-2xl border border-border bg-background p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => handleOpenRoom(room)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <h3 className="text-sm font-bold truncate">{room.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">Room ID: {room.id}</p>
                    </button>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {room.role}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {room.timestampLabel} {formatTimestamp(room.timestamp)}
                      </p>
                    </div>
                  </div>
                  {room.role === 'owner' && (
                    <div className="mt-4 flex justify-end">
                      {confirmDeleteRoomId === room.id ? (
                        <div className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive">
                          <span>Delete?</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteRoom(room)}
                            disabled={deletingRoomId === room.id}
                            className="rounded-lg border border-destructive/40 px-2 py-1 transition-colors hover:bg-destructive/10 disabled:opacity-60"
                          >
                            {deletingRoomId === room.id ? (
                              <span className="inline-flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> Yes
                              </span>
                            ) : 'Yes'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRoomId(null)}
                            disabled={deletingRoomId === room.id}
                            className="rounded-lg border border-border px-2 py-1 text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRoomId(room.id)}
                          disabled={deletingRoomId === room.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                        >
                          <Trash2 className="w-3 h-3" /> Delete room
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      </main>
    </div>
  );
}
