import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from './google.strategy';
import { AuthService } from '../auth.service';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'GOOGLE_CLIENT_ID') return 'client-id';
      if (key === 'GOOGLE_CLIENT_SECRET') return 'client-secret';
      if (key === 'GOOGLE_CALLBACK_URL')
        return 'http://localhost:3001/callback';
      return undefined;
    }),
  };

  const mockAuthService = {
    validateGoogleUser: jest
      .fn()
      .mockResolvedValue({ email: 'u@x.com', googleId: 'g-1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should use placeholder config when env vars missing', async () => {
    const module = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();
    const s = module.get<GoogleStrategy>(GoogleStrategy);
    expect(s).toBeDefined();
  });

  describe('validate', () => {
    it('should call done with user when validateGoogleUser returns user', async () => {
      const done = jest.fn();
      await strategy.validate(
        'access',
        'refresh',
        { emails: [{ value: 'u@x.com' }], id: 'g-1' },
        done,
      );
      expect(mockAuthService.validateGoogleUser).toHaveBeenCalledWith({
        emails: [{ value: 'u@x.com' }],
        id: 'g-1',
      });
      expect(done).toHaveBeenCalledWith(null, {
        email: 'u@x.com',
        googleId: 'g-1',
      });
    });

    it('should call done with error when validateGoogleUser returns null', async () => {
      mockAuthService.validateGoogleUser.mockResolvedValueOnce(null);
      const done = jest.fn();
      await strategy.validate('access', 'refresh', { id: 'g-1' }, done);
      expect(done).toHaveBeenCalledWith(expect.any(Error), undefined);
    });
  });
});
