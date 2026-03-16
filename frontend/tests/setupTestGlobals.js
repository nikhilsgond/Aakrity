// tests/setupTestGlobals.js
import { isConnectable } from '../src/shared/lib/shapeUtils.js';

// Expose for legacy tests that call isConnectable globally
global.isConnectable = isConnectable;
