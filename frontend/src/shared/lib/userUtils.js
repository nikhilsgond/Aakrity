// src/utils/userUtils.js
export const generateUserId = () => {
  return 'user_' + Math.random().toString(36).substr(2, 9);
};

export const generateUsername = () => {
  const adjectives = ['Happy', 'Creative', 'Smart', 'Quick', 'Bright', 'Calm', 'Wild', 'Bold'];
  const nouns = ['Painter', 'Designer', 'Artist', 'Creator', 'Maker', 'Drawer', 'Sketcher'];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  
  return `${adj}${noun}${num}`;
};

export const getUserColor = (userId) => {
  // Generate a consistent color based on user ID
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71',
    '#E74C3C', '#1ABC9C', '#F1C40F', '#8E44AD', '#2980B9'
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  
  return colors[Math.abs(hash) % colors.length];
};