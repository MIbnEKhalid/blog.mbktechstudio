/**
 * Root entry point — kept for backwards compatibility.
 * All backend code lives in src/. This file simply re-exports the Express app.
 */
import server from './src/app.js';

export default server;