import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';

interface MemoryCacheEntry {
  value: string;
  expiresAt: number | null;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redisClient: Redis | null = null;
  private readonly memoryCache = new Map<string, MemoryCacheEntry>();
  private isRedisAvailable = false;

  onModuleInit() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;

    try {
      this.redisClient = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Stop retrying if Redis is down
          }
          return Math.min(times * 500, 2000);
        },
      });

      this.redisClient.on('connect', () => {
        this.isRedisAvailable = true;
        this.logger.log(`Conectado ao Redis em ${host}:${port} com sucesso.`);
      });

      this.redisClient.on('error', (err) => {
        if (this.isRedisAvailable) {
          this.logger.warn(
            `Perda de conexão com Redis (${err.message}). Utilizando fallback em memória.`,
          );
        }
        this.isRedisAvailable = false;
      });

      // Tentativa inicial não bloqueante de conexão
      this.redisClient.connect().catch((err) => {
        this.isRedisAvailable = false;
        this.logger.log(
          `Redis não disponível (${err.message}). Operando em modo de cache local em memória.`,
        );
      });
    } catch (err: any) {
      this.isRedisAvailable = false;
      this.logger.log(
        `Inicializando CacheService com fallback em memória: ${err.message}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        // Ignora erros no shutdown
      }
    }
  }

  isRedisActive(): boolean {
    return this.isRedisAvailable && this.redisClient?.status === 'ready';
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisActive() && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch (err: any) {
        this.logger.warn(
          `Erro ao ler chave "${key}" do Redis: ${err.message}. Verificando cache local.`,
        );
      }
    }

    // Fallback em memória
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const stringified = JSON.stringify(value);

    if (this.isRedisActive() && this.redisClient) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          await this.redisClient.set(key, stringified, 'EX', ttlSeconds);
        } else {
          await this.redisClient.set(key, stringified);
        }
        return;
      } catch (err: any) {
        this.logger.warn(
          `Erro ao gravar chave "${key}" no Redis: ${err.message}. Gravando no cache local.`,
        );
      }
    }

    // Fallback em memória
    const expiresAt =
      ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryCache.set(key, { value: stringified, expiresAt });

    // Limpeza periódica se o mapa em memória crescer
    if (this.memoryCache.size > 2000) {
      const now = Date.now();
      for (const [k, v] of this.memoryCache.entries()) {
        if (v.expiresAt && now > v.expiresAt) {
          this.memoryCache.delete(k);
        }
      }
    }
  }

  async del(keyOrKeys: string | string[]): Promise<void> {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    if (keys.length === 0) return;

    if (this.isRedisActive() && this.redisClient) {
      try {
        await this.redisClient.del(...keys);
      } catch (err: any) {
        this.logger.warn(`Erro ao deletar chaves do Redis: ${err.message}`);
      }
    }

    keys.forEach((k) => this.memoryCache.delete(k));
  }

  async delByPattern(pattern: string): Promise<void> {
    if (this.isRedisActive() && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (err: any) {
        this.logger.warn(
          `Erro ao deletar padrão "${pattern}" no Redis: ${err.message}`,
        );
      }
    }

    // Fallback em memória usando Regex
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.memoryCache.keys()) {
      if (regexPattern.test(key)) {
        this.memoryCache.delete(key);
      }
    }
  }

  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds = 300,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const fresh = await fn();
    if (fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }

    return fresh;
  }
}
