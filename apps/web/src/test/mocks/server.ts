/* MSW server instance for Node.js / Vitest environment */

import { setupServer } from 'msw/node';
import { handlers } from './handlers.js';

export const server = setupServer(...handlers);
