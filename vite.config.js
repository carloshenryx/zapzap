import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function vercelFunctionsDev() {
  return {
    name: 'vercel-functions-dev',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        try {
          const url = new URL(req.url || '/', 'http://localhost');
          const pathname = url.pathname || '/';
          const parts = pathname.split('/').filter(Boolean);
          const fnName = parts[0];

          if (!fnName) return next();

          const moduleId = `/api/${fnName}.ts`;
          const mod = await server.ssrLoadModule(moduleId);
          const handler = mod?.default;

          if (typeof handler !== 'function') return next();

          const query = {};
          for (const [k, v] of url.searchParams.entries()) {
            if (query[k] === undefined) query[k] = v;
            else if (Array.isArray(query[k])) query[k].push(v);
            else query[k] = [query[k], v];
          }

          const request = {
            method: req.method,
            headers: req.headers,
            query,
            url: req.url,
            body: undefined,
          };

          if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const rawBody = Buffer.concat(chunks).toString('utf8');
            const contentType = String(req.headers['content-type'] || '');
            if (contentType.includes('application/json')) {
              request.body = rawBody ? JSON.parse(rawBody) : {};
            } else {
              request.body = rawBody;
            }
          }

          const response = {
            status(code) {
              res.statusCode = code;
              return response;
            },
            json(payload) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(payload));
              return response;
            },
            send(payload) {
              if (payload === undefined) {
                res.end();
                return response;
              }
              if (typeof payload === 'object') {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify(payload));
                return response;
              }
              res.end(String(payload));
              return response;
            },
            setHeader(key, value) {
              res.setHeader(key, value);
              return response;
            },
          };

          return handler(request, response);
        } catch (err) {
          server.config.logger.error(err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, error: 'Erro interno no servidor de API (dev)' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  return {
    logLevel: 'info', // Show all logs for better debugging
    plugins: [
      react(),
      vercelFunctionsDev(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.{js,jsx,ts,tsx}', 'handlers/**/*.test.{js,ts}'],
    },
  };
})
