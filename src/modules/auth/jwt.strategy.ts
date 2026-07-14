import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { JWT_SECRET } from './auth.constants';
import { AuthenticatedUser } from './authenticated-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  validate(payload: { sub: string; phone: string; role: AuthenticatedUser['role'] }): AuthenticatedUser {
    return { sub: payload.sub, phone: payload.phone, role: payload.role };
  }
}
