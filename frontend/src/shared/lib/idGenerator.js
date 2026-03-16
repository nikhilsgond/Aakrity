// src/utils/idGenerator.js
export const generateId = () => {
  return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};