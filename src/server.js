import dotenv from 'dotenv';
dotenv.config();

import server from './app.js';

const port = process.env.PORT || 3126;

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
