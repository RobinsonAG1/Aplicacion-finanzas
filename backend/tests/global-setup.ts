import { execSync } from 'node:child_process';
import { config } from 'dotenv';

export default function setup(): void {
  const result = config({ path: '.env.test', quiet: true });
  if (result.error) {
    throw new Error(`No se pudo cargar .env.test: ${result.error.message}`);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no definida para las pruebas');
  }
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env } });
}
