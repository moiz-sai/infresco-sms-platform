import { INestApplication } from '@nestjs/common';

// Shared by main.ts and e2e tests so both run the same app configuration.
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
}
