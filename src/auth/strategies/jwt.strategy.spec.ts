import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from '../auth.service';
import type { JwtPayload } from '../auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret-min-32-chars'),
  };

  const mockAuthService = {
    isTokenBlacklisted: jest.fn().mockResolvedValue(false),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should use default secret when config missing', async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();
    const s = module.get<JwtStrategy>(JwtStrategy);
    expect(s).toBeDefined();
  });

  describe('validate', () => {
    it('should return payload when token is not blacklisted', async () => {
      const req = { headers: { authorization: 'Bearer token-123' } };
      const payload: JwtPayload = { email: 'u@x.com', sub: 'sub-1' };
      const result = await strategy.validate(
        req as unknown as import('express').Request,
        payload,
      );
      expect(mockAuthService.isTokenBlacklisted).toHaveBeenCalledWith(
        'token-123',
      );
      expect(result).toEqual({ email: 'u@x.com', sub: 'sub-1' });
    });

    it('should return payload when no authorization header', async () => {
      const req = { headers: {} };
      const payload: JwtPayload = { email: 'u@x.com', sub: 'sub-1' };
      const result = await strategy.validate(
        req as unknown as import('express').Request,
        payload,
      );
      expect(mockAuthService.isTokenBlacklisted).not.toHaveBeenCalled();
      expect(result).toEqual({ email: 'u@x.com', sub: 'sub-1' });
    });

    it('should throw UnauthorizedException when token is blacklisted', async () => {
      mockAuthService.isTokenBlacklisted.mockResolvedValueOnce(true);
      const req = { headers: { authorization: 'Bearer blacklisted' } };
      const payload: JwtPayload = { email: 'u@x.com', sub: 'sub-1' };
      await expect(
        strategy.validate(req as unknown as import('express').Request, payload),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
