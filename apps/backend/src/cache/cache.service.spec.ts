import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(() => {
    service = new CacheService();
    // Simulate initialization in memory mode
    service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should set and get a value correctly', async () => {
    await service.set('test:key', { foo: 'bar' });
    const val = await service.get<{ foo: string }>('test:key');
    expect(val).toEqual({ foo: 'bar' });
  });

  it('should return null for non-existent key', async () => {
    const val = await service.get('test:not-found');
    expect(val).toBeNull();
  });

  it('should delete keys correctly', async () => {
    await service.set('test:del1', 'val1');
    await service.set('test:del2', 'val2');

    await service.del(['test:del1', 'test:del2']);

    expect(await service.get('test:del1')).toBeNull();
    expect(await service.get('test:del2')).toBeNull();
  });

  it('should delete keys by pattern', async () => {
    await service.set('rbac:user:123:modules', ['ava', 'academic']);
    await service.set('rbac:user:456:modules', ['scheduling']);
    await service.set('system:other', 'keep');

    await service.delByPattern('rbac:user:*');

    expect(await service.get('rbac:user:123:modules')).toBeNull();
    expect(await service.get('rbac:user:456:modules')).toBeNull();
    expect(await service.get('system:other')).toBe('keep');
  });

  it('should wrap cache-aside pattern correctly', async () => {
    const fetchMock = jest.fn().mockResolvedValue(['mod1', 'mod2']);

    // 1st call executes fetchMock
    const res1 = await service.wrap('wrap:key', fetchMock, 60);
    expect(res1).toEqual(['mod1', 'mod2']);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 2nd call retrieves from cache without calling fetchMock
    const res2 = await service.wrap('wrap:key', fetchMock, 60);
    expect(res2).toEqual(['mod1', 'mod2']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
