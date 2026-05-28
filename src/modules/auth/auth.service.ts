import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomInt, randomUUID } from 'crypto';

import { AuthenticatedUser } from './authenticated-user.interface';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthRole } from './auth.types';

type OtpSession = {
  phone: string;
  role: AuthRole;
  otp: string;
  expiresAt: number;
};

type RefreshSession = {
  phone: string;
  role: AuthRole;
  expiresAt: number;
};

@Injectable()
export class AuthService {
  private readonly otpTtlSeconds = 300;

  private readonly accessTokenTtlSeconds = 900;

  private readonly refreshTokenTtlSeconds = 60 * 60 * 24 * 30;

  private readonly otpSessions = new Map<string, OtpSession>();

  private readonly refreshSessions = new Map<string, RefreshSession>();

  requestOtp(payload: RequestOtpDto) {
    const sessionId = randomUUID();
    const otp = this.generateOtp();
    const role = payload.role ?? 'PATIENT';

    this.otpSessions.set(sessionId, {
      phone: payload.phone,
      role,
      otp,
      expiresAt: Date.now() + this.otpTtlSeconds * 1000,
    });

    return {
      sessionId,
      role,
      expiresInSeconds: this.otpTtlSeconds,
      deliveryChannel: 'demo',
      destination: this.maskPhone(payload.phone),
      debugOtp: this.isProduction() ? undefined : otp,
    };
  }

  verifyOtp(payload: VerifyOtpDto) {
    const session = this.otpSessions.get(payload.sessionId);

    if (!session) {
      throw new UnauthorizedException('OTP session not found');
    }

    if (session.expiresAt < Date.now()) {
      this.otpSessions.delete(payload.sessionId);
      throw new UnauthorizedException('OTP session expired');
    }

    if (session.phone !== payload.phone) {
      throw new UnauthorizedException('Phone number does not match session');
    }

    if (payload.role && session.role !== payload.role) {
      throw new UnauthorizedException('Role does not match session');
    }

    if (session.otp !== payload.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    this.otpSessions.delete(payload.sessionId);

    const refreshToken = this.issueRefreshToken(session.phone, session.role);

    return {
      accessToken: this.issueAccessToken(session.phone, session.role),
      refreshToken,
      tokenType: 'Bearer',
      expiresInSeconds: this.accessTokenTtlSeconds,
      user: {
        phone: session.phone,
        role: session.role,
        status: 'authenticated',
      },
      isDemoMode: !this.isProduction(),
    };
  }

  refreshToken(payload: RefreshTokenDto) {
    const refreshSession = this.refreshSessions.get(payload.refreshToken);

    if (!refreshSession) {
      throw new UnauthorizedException('Refresh token not found');
    }

    if (refreshSession.expiresAt < Date.now()) {
      this.refreshSessions.delete(payload.refreshToken);
      throw new UnauthorizedException('Refresh token expired');
    }

    this.refreshSessions.delete(payload.refreshToken);
    const nextRefreshToken = this.issueRefreshToken(
      refreshSession.phone,
      refreshSession.role,
    );

    return {
      accessToken: this.issueAccessToken(
        refreshSession.phone,
        refreshSession.role,
      ),
      refreshToken: nextRefreshToken,
      tokenType: 'Bearer',
      expiresInSeconds: this.accessTokenTtlSeconds,
    };
  }

  logout(payload: LogoutDto) {
    if (!this.refreshSessions.delete(payload.refreshToken)) {
      throw new BadRequestException('Refresh token already invalid');
    }

    return {
      success: true,
    };
  }

  authenticateAccessToken(token: string): AuthenticatedUser {
    if (!token.startsWith('demo-access-')) {
      throw new UnauthorizedException('Unsupported access token');
    }

    const remainder = token.replace('demo-access-', '');
    const separatorIndex = remainder.indexOf('-');

    if (separatorIndex === -1) {
      throw new UnauthorizedException('Malformed access token');
    }

    const role = remainder.slice(0, separatorIndex) as AuthRole;
    const encodedPayload = remainder.slice(separatorIndex + 1);

    if (!['PATIENT', 'DOCTOR', 'HOSPITAL_ADMIN', 'PLATFORM_ADMIN'].includes(role)) {
      throw new UnauthorizedException('Unknown token role');
    }

    try {
      const decodedPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
      const separator = decodedPayload.indexOf(':');

      if (separator === -1) {
        throw new Error('Missing payload separator');
      }

      const phone = decodedPayload.slice(0, separator);

      if (!phone) {
        throw new Error('Missing phone');
      }

      return {
        phone,
        role,
      };
    } catch {
      throw new UnauthorizedException('Invalid access token payload');
    }
  }

  private issueAccessToken(phone: string, role: AuthRole): string {
    return `demo-access-${role}-${Buffer.from(`${phone}:${randomUUID()}`).toString('base64url')}`;
  }

  private issueRefreshToken(phone: string, role: AuthRole): string {
    const refreshToken = `demo-refresh-${randomUUID()}`;

    this.refreshSessions.set(refreshToken, {
      phone,
      role,
      expiresAt: Date.now() + this.refreshTokenTtlSeconds * 1000,
    });

    return refreshToken;
  }

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private maskPhone(phone: string): string {
    const visibleDigits = phone.slice(-2);
    const maskedDigits = '*'.repeat(Math.max(phone.length - visibleDigits.length, 0));
    return `${maskedDigits}${visibleDigits}`;
  }

  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}
