import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import http from 'http';
import cors from 'cors';
import argon2 from 'argon2';
import { createClient } from '@supabase/supabase-js';
import { Server } from 'socket.io';
import { uploadImageToCloudinary } from './lib/cloudinary.js';
import { decryptText, encryptText } from './lib/crypto.js';
import {
  MAX_CANVAS_IMAGE_BYTES,
  MAX_PROFILE_IMAGE_BYTES,
  ROOM_ID_PATTERN,
  normalizePlainText,
  validateEmail,
  validateImageDataUrl,
  validatePlainText,
} from './lib/validation.js';

import { extractPublicIdFromCloudinaryUrl, deleteImageFromCloudinary } from './lib/cloudinary.js';

const {
  PORT = 3001,
  CLIENT_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173',
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  CHAT_ENCRYPTION_KEY,
} = process.env;

const isProduction = process.env.NODE_ENV === 'production';

const sendError = (res, error, defaultMessage = 'Internal server error', status = 500) => {
  console.error(`${defaultMessage}:`, error);
  const message = isProduction
    ? defaultMessage  // Generic message in production
    : error.message || defaultMessage;
  const statusCode = error.status || status;
  res.status(statusCode).json({ error: message });
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const app = express();
app.use(express.json({ limit: '15mb' }));

const allowedOrigins = CLIENT_ORIGINS
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const localOriginMatchers = [
  /^http:\/\/localhost:\d+$/i,
  /^http:\/\/127\.0\.0\.1:\d+$/i,
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/i,
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/i,
];

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  return localOriginMatchers.some((pattern) => pattern.test(origin));
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
};

app.use(cors(corsOptions));

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 15 * 1024 * 1024,
  cors: corsOptions,
});

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const roomPresence = new Map();
const roomLocks = new Map();
const socketMemberships = new Map();
const roomAccessGrants = new Map();
const roomImageUploadCache = new Map();
const chatSecret = CHAT_ENCRYPTION_KEY;
const ROOM_ACCESS_GRANT_TTL_MS = 1000 * 60 * 60 * 6;

const trimValue = (value, maxLength = 5000) => String(value || '').trim().slice(0, maxLength);
const isValidRoomId = (roomId) => ROOM_ID_PATTERN.test(trimValue(roomId, 80));

const getUserColor = (userId = '') => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71',
    '#E74C3C', '#1ABC9C', '#F1C40F', '#8E44AD', '#2980B9',
  ];

  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(index);
    hash |= 0;
  }

  return colors[Math.abs(hash) % colors.length];
};

const chunkArray = (items, chunkSize = 200) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
};

const getAccessTokenFromRequest = (request) => {
  const header = request.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
};

const createApiError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const buildRoomAccessGrantKey = (roomId, userId) => `${roomId}:${userId}`;

const grantRoomAccess = (roomId, userId) => {
  roomAccessGrants.set(buildRoomAccessGrantKey(roomId, userId), Date.now());
};

const hasValidRoomAccessGrant = (roomId, userId) => {
  const key = buildRoomAccessGrantKey(roomId, userId);
  const grantedAt = roomAccessGrants.get(key);

  if (!grantedAt) {
    return false;
  }

  if ((Date.now() - grantedAt) > ROOM_ACCESS_GRANT_TTL_MS) {
    roomAccessGrants.delete(key);
    return false;
  }

  return true;
};

const hashString = (value) => crypto.createHash('sha1').update(value).digest('hex');

const validatePassword = (value) => {
  if (!value) return 'Password is required.';
  if (value.length < 4) return 'Password must be at least 4 characters.';
  if (value.length > 128) return 'Password must be under 128 characters.';
  return null;
};

const normalizeSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const state = snapshot.state && typeof snapshot.state === 'object'
    ? snapshot.state
    : snapshot;

  return {
    version: 1,
    boardTitle: trimValue(snapshot.boardTitle || 'Untitled Board', 80) || 'Untitled Board',
    state: {
      objects: Array.isArray(state.objects) ? state.objects : [],
      viewport: state.viewport && typeof state.viewport === 'object'
        ? state.viewport
        : { zoom: 1, panX: 0, panY: 0 },
      gridStyle: trimValue(state.gridStyle || 'lines', 20) || 'lines',
      darkMode: !!state.darkMode,
    },
    savedAt: new Date().toISOString(),
  };
};

const getUserFromToken = async (accessToken) => {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data?.user) {
    throw createApiError(401, 'Unauthorized');
  }

  return data.user;
};

const ensureProfile = async (user) => {
  const { data: existingProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (existingProfile) {
    return existingProfile;
  }

  const name = normalizePlainText(
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.email?.split('@')[0] ||
    'Anonymous'
  ).slice(0, 80) || 'Anonymous';

  const avatarUrl = trimValue(user.user_metadata?.avatar_url, 500) || null;

  const { data: createdProfile, error: insertError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: user.id,
      name,
      avatar_url: avatarUrl,
    })
    .select('*')
    .single();

  if (insertError) {
    throw insertError;
  }

  return createdProfile;
};

const getViewerFromToken = async (accessToken) => {
  const authUser = await getUserFromToken(accessToken);
  const profile = await ensureProfile(authUser);
  return { authUser, profile };
};

const requireAuth = async (request, response, next) => {
  try {
    const token = getAccessTokenFromRequest(request);
    if (!token) {
      response.status(401).json({ error: 'Missing bearer token.' });
      return;
    }

    request.viewer = await getViewerFromToken(token);
    next();
  } catch (error) {
    console.error('Auth middleware failed:', error);
    response.status(error.status || 401).json({ error: error.message || 'Unauthorized' });
  }
};

const loadOwnedRoom = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const loadRoomById = async (roomId) => {
  if (!isValidRoomId(roomId)) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const loadMembershipForUser = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('room_members')
    .select('*')
    .order('joined_at', { ascending: false })
    .limit(1)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const loadMembershipsForUser = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('room_members')
    .select('*')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

const requireRoomMembership = async (roomId, userId) => {
  if (!isValidRoomId(roomId)) return null;

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('room_members')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return null;

  const room = await loadRoomById(roomId);
  if (!room) {
    throw createApiError(404, 'Room not found.');
  }

  return { room, membership };
};

const loadRoomMemberCount = async (roomId) => {
  const { count, error } = await supabaseAdmin
    .from('room_members')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId);

  if (error) throw error;
  return count || 0;
};

const listRoomUsers = (roomId) => {
  const presence = roomPresence.get(roomId);
  if (!presence) return [];

  const deduped = new Map();
  for (const participant of presence.values()) {
    deduped.set(participant.id, participant);
  }

  return Array.from(deduped.values());
};

const buildLocksPayload = (roomId) => {
  const locks = roomLocks.get(roomId);
  return locks ? Object.fromEntries(locks.entries()) : {};
};

const persistImageUrl = async ({ roomId = null, uploadedBy, url }) => {
  if (!roomId) {
    return;
  }

  const { data: existingRow, error: existingError } = await supabaseAdmin
    .from('images')
    .select('id')
    .eq('room_id', roomId)
    .eq('url', url)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error('Failed to check existing image row:', existingError);
    return;
  }

  if (existingRow) {
    return;
  }

  const { error } = await supabaseAdmin.from('images').insert({
    room_id: roomId,
    uploaded_by: uploadedBy,
    url,
  });

  if (error) {
    console.error('Failed to persist image row:', error);
  }
};

const maybeUploadObjectImage = async (object, roomId, userId, cache) => {
  if (!object || object.type !== 'image' || !object.imageData) {
    return object;
  }

  const currentValue = String(object.imageData);
  if (!currentValue.startsWith('data:image/')) {
    return {
      ...object,
      imageData: currentValue,
      url: object.url || currentValue,
      src: object.src || currentValue,
    };
  }

  if (cache.has(currentValue)) {
    const cachedUrl = cache.get(currentValue);
    return {
      ...object,
      imageData: cachedUrl,
      url: cachedUrl,
      src: cachedUrl,
    };
  }

  const validationError = validateImageDataUrl(currentValue, {
    maxBytes: MAX_CANVAS_IMAGE_BYTES,
    label: 'Canvas image',
  });

  if (validationError) {
    throw createApiError(400, validationError);
  }

  const imageHash = hashString(currentValue);
  const cacheKey = `${roomId}:${imageHash}`;

  if (roomImageUploadCache.has(cacheKey)) {
    const existingUrl = roomImageUploadCache.get(cacheKey);
    cache.set(currentValue, existingUrl);
    return {
      ...object,
      imageData: existingUrl,
      url: existingUrl,
      src: existingUrl,
    };
  }

  const uploadedUrl = await uploadImageToCloudinary(currentValue, {
    folder: `aakrity/rooms/${roomId}`,
    publicId: `img_${imageHash}`,
    overwrite: true,
  });

  roomImageUploadCache.set(cacheKey, uploadedUrl);
  cache.set(currentValue, uploadedUrl);
  await persistImageUrl({ roomId, uploadedBy: userId, url: uploadedUrl });

  return {
    ...object,
    imageData: uploadedUrl,
    url: uploadedUrl,
    src: uploadedUrl,
  };
};

const persistCanvasObjects = async (roomId, objects, userId) => {
  const imageCache = new Map();
  const persistedObjects = [];

  for (const [index, object] of objects.entries()) {
    const persistedObject = await maybeUploadObjectImage(object, roomId, userId, imageCache);
    persistedObjects.push({
      room_id: roomId,
      layer_index: index,
      object_data: persistedObject,
    });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('canvas_objects')
    .delete()
    .eq('room_id', roomId);

  if (deleteError) throw deleteError;

  if (persistedObjects.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('canvas_objects')
      .insert(persistedObjects);

    if (insertError) throw insertError;
  }

  return persistedObjects.map((entry) => entry.object_data);
};

const loadCanvasObjects = async (roomId) => {
  const { data, error } = await supabaseAdmin
    .from('canvas_objects')
    .select('*')
    .eq('room_id', roomId)
    .order('layer_index', { ascending: true });

  if (error) throw error;
  return (data || []).map((entry) => entry.object_data || {});
};

const loadLatestSnapshot = async (roomId) => {
  const { data, error } = await supabaseAdmin
    .from('board_snapshots')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
};

const loadChatMessages = async (roomId) => {
  const { data: messages, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw error;

  const userIds = [...new Set((messages || []).map((message) => message.user_id).filter(Boolean))];
  const namesById = new Map();

  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id,name,avatar_url')
      .in('id', userIds);

    if (profileError) throw profileError;
    (profiles || []).forEach((profile) => {
      namesById.set(profile.id, profile);
    });
  }

  return (messages || []).map((message) => ({
    id: message.id,
    userId: message.user_id,
    username: namesById.get(message.user_id)?.name || 'User',
    avatarUrl: namesById.get(message.user_id)?.avatar_url || null,
    content: decryptText(message.encrypted_message, chatSecret),
    timestamp: new Date(message.created_at).getTime(),
  }));
};

const deleteRoomMembershipIfOffline = async (roomId, userId) => {
  return { roomId, userId };
};

const removeSocketPresence = async (socketId) => {
  const membership = socketMemberships.get(socketId);
  if (!membership) return;

  const { roomId, userId } = membership;
  socketMemberships.delete(socketId);

  const presence = roomPresence.get(roomId);
  if (!presence) {
    await deleteRoomMembershipIfOffline(roomId, userId);
    return;
  }

  presence.delete(socketId);

  const userStillPresent = Array.from(presence.values()).some((entry) => entry.id === userId);
  if (!userStillPresent) {
    io.to(roomId).emit('user-left', userId);
    await deleteRoomMembershipIfOffline(roomId, userId);
  }

  const locks = roomLocks.get(roomId);
  if (locks) {
    const unlockedIds = [];
    for (const [objectId, lock] of locks.entries()) {
      if (lock.userId === userId) {
        locks.delete(objectId);
        unlockedIds.push(objectId);
      }
    }

    if (unlockedIds.length > 0) {
      io.to(roomId).emit('object:unlocked', {
        userId,
        objectIds: unlockedIds,
      });
    }

    if (locks.size === 0) {
      roomLocks.delete(roomId);
    }
  }

  if (presence.size === 0) {
    roomPresence.delete(roomId);
  }
};

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    timestamp: Date.now(),
    activeRooms: roomPresence.size,
    activeConnections: socketMemberships.size,
  });
});

app.get('/api/auth/me', requireAuth, async (request, response) => {
  try {
    const activeMembership = await loadMembershipForUser(request.viewer.authUser.id);
    response.json({
      user: {
        id: request.viewer.authUser.id,
        email: request.viewer.authUser.email,
      },
      profile: request.viewer.profile,
      activeMembership,
    });
  } catch (error) {
    console.error('Failed to load viewer profile:', error);
    response.status(500).json({ error: 'Failed to load profile.' });
  }
});

app.post('/api/profile/avatar', requireAuth, async (request, response) => {
  try {
    const validationError = validateImageDataUrl(request.body?.dataUrl, {
      maxBytes: MAX_PROFILE_IMAGE_BYTES,
      label: 'Profile image',
    });

    if (validationError) {
      response.status(400).json({ error: validationError });
      return;
    }

    const { data: oldProfile } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('id', request.viewer.authUser.id)
      .single();

    const oldAvatarUrl = oldProfile?.avatar_url;

    const uploadedUrl = await uploadImageToCloudinary(request.body.dataUrl, {
      folder: `aakrity/profiles/${request.viewer.authUser.id}`,
    });

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .update({ avatar_url: uploadedUrl })
      .eq('id', request.viewer.authUser.id)
      .select('*')
      .single();

    if (error) throw error;

    if (oldAvatarUrl && oldAvatarUrl !== uploadedUrl) {
      try {
        const publicId = extractPublicIdFromCloudinaryUrl(oldAvatarUrl);
        if (publicId) {
          await deleteImageFromCloudinary(publicId);
        }
      } catch (deleteError) {
        console.error('Failed to delete old avatar:', deleteError);
      }
    }

    await persistImageUrl({
      roomId: null,
      uploadedBy: request.viewer.authUser.id,
      url: uploadedUrl,
    });

    response.json({ profile });
  } catch (error) {
    sendError(response, error, 'Failed to upload profile image.');
  }
});

app.get('/api/rooms', requireAuth, async (request, response) => {
  try {
    const [ownedRoom, memberships] = await Promise.all([
      loadOwnedRoom(request.viewer.authUser.id),
      loadMembershipsForUser(request.viewer.authUser.id),
    ]);

    const joinedRoomIds = [...new Set(memberships.map((membership) => membership.room_id).filter(Boolean))];
    const joinedRooms = [];

    for (const membership of memberships) {
      const room = await loadRoomById(membership.room_id);
      if (!room) {
        continue;
      }

      joinedRooms.push({
        ...room,
        membership,
      });
    }

    response.json({
      ownedRoom,
      joinedRooms,
      activeRoom: joinedRooms[0] || null,
      activeMembership: memberships[0] || null,
    });
  } catch (error) {
    sendError(response, error, 'Failed to load rooms.');
  }
});

app.post('/api/rooms', requireAuth, async (request, response) => {
  try {
    const nameError = validatePlainText(request.body?.name, {
      label: 'Room name',
      minLength: 2,
      maxLength: 80,
    });
    const passwordError = validatePassword(trimValue(request.body?.password, 128));

    if (nameError || passwordError) {
      response.status(400).json({ error: nameError || passwordError });
      return;
    }

    const ownedRoom = await loadOwnedRoom(request.viewer.authUser.id);
    if (ownedRoom) {
      response.status(409).json({ error: 'You already own a room. Delete it before creating another.' });
      return;
    }

    const passwordHash = await argon2.hash(request.body.password);
    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .insert({
        owner_id: request.viewer.authUser.id,
        name: normalizePlainText(request.body.name).slice(0, 80),
        password_hash: passwordHash,
        max_members: Math.max(2, Math.min(50, Number(request.body?.maxMembers) || 10)),
      })
      .select('*')
      .single();

    if (roomError) throw roomError;

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('room_members')
      .insert({
        room_id: room.id,
        user_id: request.viewer.authUser.id,
      })
      .select('*')
      .single();

    if (memberError) throw memberError;

    grantRoomAccess(room.id, request.viewer.authUser.id);

    response.status(201).json({ room, membership });
  } catch (error) {
    sendError(response, error, 'Failed to create room.');
  }
});

app.post('/api/rooms/join', requireAuth, async (request, response) => {
  try {
    const roomId = trimValue(request.body?.roomId, 80);
    const password = trimValue(request.body?.password, 128);

    if (!roomId) {
      response.status(400).json({ error: 'Room ID is required.' });
      return;
    }

    if (!isValidRoomId(roomId)) {
      response.status(400).json({ error: 'Room ID is invalid.' });
      return;
    }

    const room = await loadRoomById(roomId);
    if (!room) {
      response.status(404).json({ error: 'Room deleted or not found.' });
      return;
    }

    const passwordValid = await argon2.verify(room.password_hash, password);
    if (!passwordValid) {
      response.status(403).json({ error: 'Invalid room password.' });
      return;
    }

    const existingMemberships = await loadMembershipsForUser(request.viewer.authUser.id);
    const existingMembership = existingMemberships.find((membership) => membership.room_id === room.id) || null;

    const roomMemberCount = await loadRoomMemberCount(room.id);
    if (!existingMembership && roomMemberCount >= room.max_members) {
      response.status(403).json({ error: 'Room full.' });
      return;
    }

    const membership = existingMembership
      ? existingMembership
      : await (async () => {
        const { data, error } = await supabaseAdmin
          .from('room_members')
          .insert({
            room_id: room.id,
            user_id: request.viewer.authUser.id,
          })
          .select('*')
          .single();

        if (error) throw error;
        return data;
      })();

    grantRoomAccess(room.id, request.viewer.authUser.id);

    response.json({ room, membership });
  } catch (error) {
    sendError(response, error, 'Failed to join room.');
  }
});

app.delete('/api/rooms/:roomId', requireAuth, async (request, response) => {
  try {
    const room = await loadRoomById(request.params.roomId);
    if (!room) {
      response.status(404).json({ error: 'Room deleted or not found.' });
      return;
    }

    if (room.owner_id !== request.viewer.authUser.id) {
      response.status(403).json({ error: 'Only the room owner can delete this room.' });
      return;
    }

    io.to(room.id).emit('room:deleted', { roomId: room.id });

    const { error } = await supabaseAdmin
      .from('rooms')
      .delete()
      .eq('id', room.id);

    if (error) throw error;

    roomPresence.delete(room.id);
    roomLocks.delete(room.id);

    response.json({ deleted: true });
  } catch (error) {
    sendError(response, error, 'Failed to delete room.');
  }
});

app.get('/api/rooms/:roomId/bootstrap', requireAuth, async (request, response) => {
  try {
    const access = await requireRoomMembership(request.params.roomId, request.viewer.authUser.id);
    if (!access) {
      response.status(403).json({ error: 'You are not currently inside this room. Rejoin with the password.' });
      return;
    }

    if (!hasValidRoomAccessGrant(access.room.id, request.viewer.authUser.id)) {
      response.status(403).json({ error: 'Room password verification required. Rejoin with the password.' });
      return;
    }

    const [objects, latestSnapshot, chatMessages] = await Promise.all([
      loadCanvasObjects(access.room.id),
      loadLatestSnapshot(access.room.id),
      loadChatMessages(access.room.id),
    ]);

    response.json({
      room: access.room,
      membership: access.membership,
      latestSnapshot,
      objectChunks: chunkArray(objects, 200),
      chatMessages,
      users: listRoomUsers(access.room.id),
    });
  } catch (error) {
    sendError(response, error, 'Failed to bootstrap room.');
  }
});

app.put('/api/rooms/:roomId/snapshot', requireAuth, async (request, response) => {
  try {
    const access = await requireRoomMembership(request.params.roomId, request.viewer.authUser.id);
    if (!access) {
      response.status(403).json({ error: 'You are not currently inside this room. Rejoin with the password.' });
      return;
    }

    const snapshot = normalizeSnapshot(request.body?.snapshot);
    if (!snapshot) {
      response.status(400).json({ error: 'Invalid snapshot payload.' });
      return;
    }

    const persistedObjects = await persistCanvasObjects(
      access.room.id,
      snapshot.state.objects,
      request.viewer.authUser.id
    );

    const persistedSnapshot = {
      ...snapshot,
      state: {
        ...snapshot.state,
        objects: persistedObjects,
      },
      savedAt: new Date().toISOString(),
    };

    const { data: snapshotRow, error } = await supabaseAdmin
      .from('board_snapshots')
      .insert({
        room_id: access.room.id,
        snapshot: persistedSnapshot,
      })
      .select('*')
      .single();

    if (error) throw error;

    response.json({
      savedAt: snapshotRow.created_at,
      objectCount: persistedObjects.length,
    });
  } catch (error) {
    sendError(response, error, 'Failed to save board snapshot.');
  }
});

app.post('/api/contact', async (request, response) => {
  try {
    const nameError = validatePlainText(request.body?.name, {
      label: 'Name',
      minLength: 2,
      maxLength: 120,
      pattern: /^[a-zA-Z0-9 .,'-]+$/,
    });
    const emailError = validateEmail(request.body?.email);
    const subjectError = request.body?.subject
      ? validatePlainText(request.body.subject, {
        label: 'Subject',
        required: false,
        minLength: 2,
        maxLength: 200,
      })
      : null;
    const messageError = validatePlainText(request.body?.message, {
      label: 'Message',
      minLength: 10,
      maxLength: 5000,
    });

    const firstError = nameError || emailError || subjectError || messageError;
    if (firstError) {
      response.status(400).json({ success: false, errors: [firstError] });
      return;
    }

    const { error } = await supabaseAdmin.from('contact_messages').insert({
      name: normalizePlainText(request.body.name).slice(0, 120),
      email: trimValue(request.body.email, 320),
      subject: request.body.subject ? normalizePlainText(request.body.subject).slice(0, 200) : null,
      message: trimValue(request.body.message, 5000),
    });

    if (error) throw error;

    response.json({ success: true, message: 'Message stored successfully.' });
  } catch (error) {
    sendError(response, error, 'Failed to store contact message.');
  }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }

    socket.data.viewer = await getViewerFromToken(token);
    next();
  } catch (error) {
    console.error('Socket auth failed:', error);
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const viewer = socket.data.viewer;

  socket.on('join-room', async ({ roomId }) => {
    try {
      const access = await requireRoomMembership(roomId, viewer.authUser.id);
      if (!access) {
        socket.emit('room:error', { message: 'You are not currently inside this room. Rejoin with the password.' });
        return;
      }

      if (!hasValidRoomAccessGrant(access.room.id, viewer.authUser.id)) {
        socket.emit('room:error', { message: 'Room password verification required. Rejoin with the password.' });
        return;
      }

      socket.join(access.room.id);
      socketMemberships.set(socket.id, {
        roomId: access.room.id,
        userId: viewer.authUser.id,
      });

      if (!roomPresence.has(access.room.id)) {
        roomPresence.set(access.room.id, new Map());
      }

      const participant = {
        id: viewer.authUser.id,
        socketId: socket.id,
        name: viewer.profile.name,
        avatarUrl: viewer.profile.avatar_url || null,
        color: getUserColor(viewer.authUser.id),
        isActive: true,
        joinedAt: Date.now(),
      };

      roomPresence.get(access.room.id).set(socket.id, participant);

      socket.emit('room-joined', {
        roomId: access.room.id,
        users: listRoomUsers(access.room.id),
        title: null,
        locks: buildLocksPayload(access.room.id),
      });

      socket.to(access.room.id).emit('user-joined', participant);
    } catch (error) {
      console.error('Socket join-room failed:', error);
      socket.emit('room:error', { message: error.message || 'Failed to join room.' });
    }
  });

  socket.on('cursor-move', ({ roomId, position }) => {
    const membership = socketMemberships.get(socket.id);
    if (!membership || membership.roomId !== roomId) return;

    socket.to(roomId).emit('cursor-move', {
      userId: membership.userId,
      position,
    });
  });

  socket.on('canvas-operation', ({ roomId, operation }) => {
    const membership = socketMemberships.get(socket.id);
    if (!membership || membership.roomId !== roomId || !operation) return;

    socket.to(roomId).emit('canvas-operation', {
      userId: membership.userId,
      operation,
    });
  });

  socket.on('chat-message', async ({ roomId, message, timestamp }) => {
    const membership = socketMemberships.get(socket.id);
    if (!membership || membership.roomId !== roomId) return;

    const validationError = validatePlainText(message, {
      label: 'Message',
      minLength: 1,
      maxLength: 2000,
    });

    if (validationError) {
      socket.emit('chat:error', { message: validationError });
      return;
    }

    try {
      const encryptedMessage = encryptText(normalizePlainText(message, 2000), chatSecret);
      const createdAt = new Date(timestamp || Date.now()).toISOString();

      const { data, error } = await supabaseAdmin
        .from('chat_messages')
        .insert({
          room_id: roomId,
          user_id: membership.userId,
          encrypted_message: encryptedMessage,
          created_at: createdAt,
        })
        .select('*')
        .single();

      if (error) throw error;

      io.to(roomId).emit('chat-message', {
        id: data.id,
        userId: membership.userId,
        username: viewer.profile.name,
        avatarUrl: viewer.profile.avatar_url || null,
        content: normalizePlainText(message, 2000),
        timestamp: new Date(data.created_at).getTime(),
      });
    } catch (error) {
      console.error('Failed to store chat message:', error);
      socket.emit('chat:error', { message: 'Failed to send chat message.' });
    }
  });

  socket.on('object:lock', ({ roomId, objectIds }) => {
    const membership = socketMemberships.get(socket.id);
    if (!membership || membership.roomId !== roomId || !Array.isArray(objectIds)) return;

    if (!roomLocks.has(roomId)) {
      roomLocks.set(roomId, new Map());
    }

    const locks = roomLocks.get(roomId);
    const lockedIds = [];

    objectIds.forEach((objectId) => {
      const currentLock = locks.get(objectId);
      if (!currentLock || currentLock.userId === membership.userId) {
        locks.set(objectId, {
          userId: membership.userId,
          username: viewer.profile.name,
          timestamp: Date.now(),
        });
        lockedIds.push(objectId);
      }
    });

    if (lockedIds.length > 0) {
      io.to(roomId).emit('object:locked', {
        userId: membership.userId,
        username: viewer.profile.name,
        objectIds: lockedIds,
      });
    }
  });

  socket.on('object:unlock', ({ roomId, objectIds }) => {
    const membership = socketMemberships.get(socket.id);
    if (!membership || membership.roomId !== roomId || !Array.isArray(objectIds)) return;

    const locks = roomLocks.get(roomId);
    if (!locks) return;

    const unlockedIds = [];
    objectIds.forEach((objectId) => {
      const currentLock = locks.get(objectId);
      if (currentLock?.userId === membership.userId) {
        locks.delete(objectId);
        unlockedIds.push(objectId);
      }
    });

    if (unlockedIds.length > 0) {
      io.to(roomId).emit('object:unlocked', {
        userId: membership.userId,
        objectIds: unlockedIds,
      });
    }
  });

  socket.on('disconnecting', async () => {
    await removeSocketPresence(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
