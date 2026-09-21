import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { resolveJwtSecret } from '../../core/security/security-env';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    JwtModule.register({
      global: true,
      secret: resolveJwtSecret(),
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
