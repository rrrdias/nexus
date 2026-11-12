import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { StudentSessionGuard } from './student-session.guard';
import {
  createStudentSessionToken,
  verifyStudentSessionToken,
} from '../student-session.util';

describe('StudentSessionGuard & student-session.util', () => {
  const secret = 'test-session-secret-key-12345';
  let guard: StudentSessionGuard;

  beforeEach(() => {
    process.env.STUDENT_SESSION_SECRET = secret;
    guard = new StudentSessionGuard();
  });

  describe('student-session.util', () => {
    it('should generate valid token and verify matching matricula', () => {
      const token = createStudentSessionToken('G2610162', secret);
      const res = verifyStudentSessionToken(token, 'g2610162', secret);
      expect(res.valid).toBe(true);
      expect(res.matricula).toBe('G2610162');
    });

    it('should REJECT token with different matricula', () => {
      const token = createStudentSessionToken('G2610162', secret);
      const res = verifyStudentSessionToken(token, 'ALUNO_OUTRO', secret);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('não coincide');
    });

    it('should REJECT forged/tampered signature', () => {
      const token = createStudentSessionToken('G2610162', secret);
      const parts = token.split('.');
      parts[2] =
        'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
      const tampered = parts.join('.');
      const res = verifyStudentSessionToken(tampered, 'G2610162', secret);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('inválida');
    });

    it('should REJECT expired token (> 30 mins)', () => {
      const pastTime = (Date.now() - 31 * 60 * 1000).toString();
      const hmac = crypto
        .createHmac('sha256', secret)
        .update(`G2610162:${pastTime}`)
        .digest('hex');
      const expiredToken = `G2610162.${pastTime}.${hmac}`;

      const res = verifyStudentSessionToken(expiredToken, 'G2610162', secret);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('expirada');
    });
  });

  describe('StudentSessionGuard.canActivate', () => {
    function mockContext(
      headers: any,
      query: any = {},
      body: any = {},
    ): ExecutionContext {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            headers,
            query,
            body,
          }),
        }),
      } as any;
    }

    it('should ALLOW access when valid token is in X-Student-Session header', () => {
      const token = createStudentSessionToken('G2610162', secret);
      const ctx = mockContext(
        { 'x-student-session': token },
        { matricula: 'G2610162' },
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should ALLOW access when valid token is in cookie', () => {
      const token = createStudentSessionToken('G2610162', secret);
      const ctx = mockContext(
        { cookie: `nexus_student_session=${token}; other=123` },
        {},
        { matricula: 'G2610162' },
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should THROW UnauthorizedException when token is missing', () => {
      const ctx = mockContext({}, { matricula: 'G2610162' });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('should THROW UnauthorizedException when token belongs to another matricula', () => {
      const token = createStudentSessionToken('OUTRO_ALUNO', secret);
      const ctx = mockContext(
        { 'x-student-session': token },
        { matricula: 'G2610162' },
      );
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
  });
});
