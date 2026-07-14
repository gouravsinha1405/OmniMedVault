import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';

import { UsersService } from '../users/users.service';
import { AuthenticatedUser } from './authenticated-user.interface';

interface OtpRecord {
  otp: string;
  expiresAt: number; // Unix ms
  used: boolean;
}

interface RefreshTokenRecord {
  userId: string;
  phone: string;
  role: AuthenticatedUser['role'];
  expiresAt: number; // Unix ms
  used: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // ponytail: in-memory stores; replace with Redis + DB for production
  private readonly otpStore = new Map<string, OtpRecord>();
  private readonly otpRateLimit = new Map<string, number[]>(); // phone → request timestamps (ms)
  private readonly refreshTokenStore = new Map<string, RefreshTokenRecord>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  // Sends (or logs in dev) a 6-digit OTP; enforces BR-A01 and BR-A02
  requestOtp(phone: string): { message: string; expiresInSeconds: number } {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;

    // BR-A02: max 5 requests per phone per hour
    const recent = (this.otpRateLimit.get(phone) ?? []).filter(t => now - t < windowMs);
    if (recent.length >= 5) {
      throw new HttpException(
        { errorResponse: { errorCode: 1000, description: 'OTP rate limit exceeded. Try again in an hour.' } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.otpRateLimit.set(phone, recent);

    // BR-A01: 6-digit OTP, 10-min expiry, single-use
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    this.otpStore.set(phone, { otp, expiresAt: now + 10 * 60 * 1000, used: false });

    // ponytail: no SMS in dev — log OTP to console; wire to AWS SNS / Twilio for production
    this.logger.log(`[DEV] OTP for ${phone}: ${otp}`);

    return { message: `OTP sent to ${phone}`, expiresInSeconds: 600 };
  }

  // Validates OTP, auto-creates PATIENT profile on first verify (BR-A07), issues JWT pair
  verifyOtp(phone: string, otp: string) {
    const record = this.otpStore.get(phone);

    if (!record) {
      throw new HttpException(
        { errorResponse: { errorCode: 1003, description: 'No OTP found for this number. Request a new OTP first.' } },
        HttpStatus.NOT_FOUND,
      );
    }

    if (record.used || Date.now() > record.expiresAt || record.otp !== otp) {
      throw new UnauthorizedException({ errorResponse: { errorCode: 1001, description: 'Invalid or expired OTP.' } });
    }

    // BR-A01: single-use; mark consumed immediately
    record.used = true;

    // BR-A07: auto-create PATIENT account on first OTP verification for a new number
    const isNewUser = !this.usersService.hasPatientProfile(phone);
    const profile = this.usersService.getPatientProfile(phone);

    return this.issueTokenPair(profile.id, phone, 'PATIENT', isNewUser);
  }

  // Issues new access + refresh tokens, rotating the old refresh token (BR-A05)
  refreshTokens(refreshToken: string) {
    const record = this.refreshTokenStore.get(refreshToken);

    if (!record || record.used || Date.now() > record.expiresAt) {
      throw new UnauthorizedException({ errorResponse: { errorCode: 1001, description: 'Invalid or expired refresh token.' } });
    }

    // BR-A05: one-time use; invalidate the consumed token before issuing new pair
    record.used = true;

    const { accessToken, refreshToken: newRefresh } = this.issueTokenPair(
      record.userId,
      record.phone,
      record.role,
      false,
    );

    return { accessToken, refreshToken: newRefresh, expiresIn: 900 };
  }

  // Invalidates the refresh token; access tokens remain valid until expiry (BR-A06)
  logout(refreshToken: string): void {
    const record = this.refreshTokenStore.get(refreshToken);
    if (record) record.used = true;
  }

  // Validates a Bearer token and returns the authenticated user; used by DemoAuthGuard
  authenticateAccessToken(token: string): AuthenticatedUser {
    try {
      const payload = this.jwtService.verify<{ sub: string; phone: string; role: AuthenticatedUser['role'] }>(token);
      return { sub: payload.sub, phone: payload.phone, role: payload.role };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private issueTokenPair(
    userId: string,
    phone: string,
    role: AuthenticatedUser['role'],
    isNewUser: boolean,
  ) {
    // BR-A03: 15-min access token; BR-A09: payload { sub: userId, role }
    // ponytail: phone included alongside sub so in-memory services can resolve by phone key
    const accessToken = this.jwtService.sign({ sub: userId, phone, role });

    // BR-A04: 30-day opaque refresh token (UUID)
    const refreshToken = randomUUID();
    this.refreshTokenStore.set(refreshToken, {
      userId,
      phone,
      role,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      used: false,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: { id: userId, role, isNewUser },
    };
  }
}
