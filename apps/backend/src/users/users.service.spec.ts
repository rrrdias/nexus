import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DB_CONNECTION } from '../db/db.provider';

describe('UsersService', () => {
  let service: UsersService;
  const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: DB_CONNECTION, useValue: mockDb }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
