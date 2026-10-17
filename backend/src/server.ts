import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Servidor escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string): void {
  logger.info(`Senal ${signal} recibida, cerrando servidor...`);
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error al cerrar el servidor');
      process.exit(1);
    }
    logger.info('Servidor cerrado correctamente');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Promesa rechazada no controlada');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Excepcion no controlada, cerrando proceso');
  process.exit(1);
});
