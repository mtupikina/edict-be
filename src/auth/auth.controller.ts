import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { JwtPayload } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthExceptionFilter } from './filters/auth-exception.filter';

@Controller('auth')
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as { email: string; googleId: string };
    const { access_token } = this.authService.login(user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4201';
    res.redirect(`${frontendUrl}/auth/callback?token=${access_token}`);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (token) {
      await this.authService.logout(token);
    }
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: JwtPayload) {
    const dbUser = await this.usersService.findOneByEmail(user.email);
    if (!dbUser) {
      return { email: user.email, firstName: null, lastName: null };
    }
    return {
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
    };
  }
}
