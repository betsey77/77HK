import serverless from 'serverless-http';
import app from '../../server/dist/app.js';

const handler = serverless(app);

export { handler };
