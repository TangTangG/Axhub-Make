import { networkInterfaces } from 'node:os';

export function getLocalIP(): string {
  const interfaces = networkInterfaces();

  for (const nets of Object.values(interfaces)) {
    for (const net of nets || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  return 'localhost';
}
