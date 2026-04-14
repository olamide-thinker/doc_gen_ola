import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { ConfigService } from '@nestjs/config';

export const DRIZZLE_PROVIDER = 'DRIZZLE_PROVIDER';

export const databaseProvider = {
  provide: DRIZZLE_PROVIDER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const connectionString = configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment');
    }
    const client = postgres(connectionString, { prepare: false });
    return drizzle(client, { schema });
  },
};
