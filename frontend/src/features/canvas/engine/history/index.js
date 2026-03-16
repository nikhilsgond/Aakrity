// src/canvas/history/index.js - UPDATED
import { HistoryManager } from './HistoryManager';
import { BaseCommand } from './BaseCommand';

// Command registry for deserialization
const commandRegistry = {};

/**
 * Register a command class for deserialization
 */
export function registerCommand(CommandClass) {
  if (!CommandClass || !CommandClass.name) {
    throw new Error('Invalid command class provided for registration');
  }

  commandRegistry[CommandClass.name] = CommandClass;
  console.log(`Registered command: ${CommandClass.name}`);
}

/**
 * Get command registry for deserialization
 */
export function getCommandRegistry() {
  return { ...commandRegistry };
}

/**
 * Deserialize a command from JSON data
 */
export function deserializeCommand(data) {
  if (!data || !data.type) {
    throw new Error('Invalid command data: missing type property');
  }

  const CommandClass = commandRegistry[data.type];
  if (!CommandClass) {
    throw new Error(`Unknown command type: ${data.type}. Available: ${Object.keys(commandRegistry).join(', ')}`);
  }

  try {
    return CommandClass.deserialize(data);
  } catch (error) {
    console.error(`Failed to deserialize command ${data.type}:`, error);
    throw new Error(`Command deserialization failed: ${data.type}`);
  }
}

/**
 * Check if a command type is registered
 */
export function isCommandRegistered(commandType) {
  return commandRegistry[commandType] !== undefined;
}

/**
 * Clear command registry (for testing)
 */
export function clearCommandRegistry() {
  Object.keys(commandRegistry).forEach(key => {
    delete commandRegistry[key];
  });
}

// Export main classes
export { HistoryManager, BaseCommand };