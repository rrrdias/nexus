import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyStudentSessionToken } from '../student-session.util';

@Injectable()
export class StudentSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    // Extrair token do header X-Student-Session ou cookie nexus_student_session
    const tokenHeader =
      req.headers['x-student-session'] || req.headers['x-student-token'];
    const cookieHeader = req.headers['cookie'];
    let cookieToken: string | undefined;

    if (cookieHeader && typeof cookieHeader === 'string') {
      const match = cookieHeader.match(/nexus_student_session=([^;]+)/);
      if (match) {
        cookieToken = decodeURIComponent(match[1]);
      }
    }

    const token = (tokenHeader || cookieToken) as string | undefined;

    // Extrair matrícula esperada do query param ou body
    const queryMat =
      typeof req.query?.matricula === 'string'
        ? req.query.matricula.trim()
        : undefined;
    const bodyMat =
      typeof req.body?.matricula === 'string'
        ? req.body.matricula.trim()
        : undefined;
    const expectedMatricula = queryMat || bodyMat;

    const result = verifyStudentSessionToken(token, expectedMatricula);

    if (!result.valid) {
      throw new UnauthorizedException(
        result.reason ||
          'Sessão do estudante inválida ou expirada. Acesse pelo AVA para iniciar uma nova sessão.',
      );
    }

    req.studentSession = { matricula: result.matricula };
    return true;
  }
}
