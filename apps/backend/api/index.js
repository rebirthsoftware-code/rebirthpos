// Vercel serverless function — tüm istekleri NestJS'e (dist/serverless) yönlendirir.
// Build adımı (nest build) dist/serverless.js üretir; vercel.json bunu includeFiles ile pakete katar.
const { createServer } = require('../dist/serverless');

let serverPromise;

module.exports = async (req, res) => {
  if (!serverPromise) serverPromise = createServer();
  const server = await serverPromise;
  return server(req, res);
};
