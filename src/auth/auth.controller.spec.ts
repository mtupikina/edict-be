import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';

import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    login: jest.fn().mockReturnValue({ access_token: 'mock-token' }),
    logout: jest.fn().mockResolvedValue(undefined),
  };

  const mockUsersService = {
    findOneByEmail: jest.fn().mockResolvedValue({
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('googleAuthCallback', () => {
    it('should redirect with token', () => {
      const req = { user: { email: 'a@b.com', googleId: 'g-1' } };
      const res = { redirect: jest.fn() };
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4201';

      controller.googleAuthCallback(
        req as unknown as Request,
        res as unknown as Response,
      );

      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'a@b.com',
        googleId: 'g-1',
      });
      expect(res.redirect).toHaveBeenCalledWith(
        `${frontendUrl}/auth/callback?token=mock-token`,
      );
    });

    it('should redirect to FRONTEND_URL when set', () => {
      const prev = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'https://app.example.com';
      const req = { user: { email: 'a@b.com', googleId: 'g-1' } };
      const res = { redirect: jest.fn() };

      controller.googleAuthCallback(
        req as unknown as Request,
        res as unknown as Response,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        'https://app.example.com/auth/callback?token=mock-token',
      );
      process.env.FRONTEND_URL = prev;
    });
  });

  describe('logout', () => {
    it('should call authService.logout with token from header', async () => {
      const req = { headers: { authorization: 'Bearer my-token' } };
      const result = await controller.logout(req as unknown as Request);
      expect(mockAuthService.logout).toHaveBeenCalledWith('my-token');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should not call logout when no authorization header', async () => {
      const req = { headers: {} };
      const result = await controller.logout(req as unknown as Request);
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should not call logout when authorization is Bearer with no token', async () => {
      const req = { headers: { authorization: 'Bearer ' } };
      const result = await controller.logout(req as unknown as Request);
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('getProfile', () => {
    it('should return email, firstName, lastName', async () => {
      const user = { email: 'user@example.com', sub: 'sub-1' };
      const result = await controller.getProfile(user);
      expect(mockUsersService.findOneByEmail).toHaveBeenCalledWith(
        'user@example.com',
      );
      expect(result).toEqual({
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('should return email and null names when user not found', async () => {
      mockUsersService.findOneByEmail.mockResolvedValueOnce(null);
      const user = { email: 'unknown@example.com', sub: 'sub-1' };
      const result = await controller.getProfile(user);
      expect(result).toEqual({
        email: 'unknown@example.com',
        firstName: null,
        lastName: null,
      });
    });
  });
});
