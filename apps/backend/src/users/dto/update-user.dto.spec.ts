import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

async function transformAndValidate(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateUserDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('UpdateUserDto', () => {
  const basePayload = {
    name: 'Maria Silva',
    email: 'maria.silva@unievangelica.edu.br',
    isActive: true,
    groupIds: ['group-1'],
    moduleIds: ['module-1', 'module-2'],
  };

  it('should accept empty string password and transform it to undefined', async () => {
    const { dto, errors } = await transformAndValidate({
      ...basePayload,
      password: '',
    });

    expect(errors).toHaveLength(0);
    expect(dto.password).toBeUndefined();
  });

  it('should accept whitespace-only password and transform it to undefined', async () => {
    const { dto, errors } = await transformAndValidate({
      ...basePayload,
      password: '   ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.password).toBeUndefined();
  });

  it('should pass when password is omitted', async () => {
    const { dto, errors } = await transformAndValidate({ ...basePayload });

    expect(errors).toHaveLength(0);
    expect(dto.password).toBeUndefined();
  });

  it('should accept empty string userid and transform it to undefined', async () => {
    const { dto, errors } = await transformAndValidate({
      ...basePayload,
      userid: '',
    });

    expect(errors).toHaveLength(0);
    expect(dto.userid).toBeUndefined();
  });

  it('should reject password shorter than 6 characters when provided', async () => {
    const { errors } = await transformAndValidate({
      ...basePayload,
      password: '12345',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
    expect(errors[0].constraints?.minLength).toBeDefined();
  });

  it('should accept password with 6 or more characters', async () => {
    const { dto, errors } = await transformAndValidate({
      ...basePayload,
      password: ' 123456 ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.password).toBe('123456');
  });
});
