import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './authenticated-user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async login(payload: LoginDto) {
    // Ponytail mode: hardcoded OTP for frictionless dev/testing. 
    // In production, wire this to AWS SNS, Twilio, or MSG91.
    if (payload.otp !== '123456') {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (payload.role === 'PATIENT') {
      // Bootstraps the patient profile if it doesn't exist yet via your ensurePatientProfile map
      void this.usersService.getPatientProfile(payload.phone);
    }

    const user: AuthenticatedUser = { phone: payload.phone, role: payload.role };
    return {
      accessToken: this.jwtService.sign(user),
    };
  }
}