import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue({
        access_token: 'fake_jwt_token',
        user: { id: '1', name: 'Test User' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call authService.login on signIn', async () => {
    const result = await controller.signIn({ email: 'user@test.com', password: 'password123' });
    expect(authService.login).toHaveBeenCalledWith('user@test.com', 'password123');
    expect(result.access_token).toBe('fake_jwt_token');
  });
});
