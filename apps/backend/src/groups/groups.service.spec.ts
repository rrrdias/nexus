import { Test, TestingModule } from '@nestjs/testing';
import { GroupsService } from './groups.service';
import { DB_CONNECTION } from '../db/db.provider';

describe('GroupsService', () => {
  let service: GroupsService;
  const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupsService, { provide: DB_CONNECTION, useValue: mockDb }],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
