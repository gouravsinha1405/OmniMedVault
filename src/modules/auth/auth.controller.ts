import { Body, Controller, Post } from '@nestjs/common';

import { AuthService } from './auth.service';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  requestOtp(@Body() payload: RequestOtpDto) {
    return this.authService.requestOtp(payload);
  }

  @Post('otp/verify')
  verifyOtp(@Body() payload: VerifyOtpDto) {
    return this.authService.verifyOtp(payload);
  }

  @Post('token/refresh')
  refreshToken(@Body() payload: RefreshTokenDto) {
    return this.authService.refreshToken(payload);
  }

  @Post('logout')
  logout(@Body() payload: LogoutDto) {
    return this.authService.logout(payload);
  }
}
