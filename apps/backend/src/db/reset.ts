import { db } from './index';
import { users } from './schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function main() {
  console.log('Resetando senha para admin...');
  const newPassword = await hashPassword('admin');
  
  await db.update(users)
    .set({ password: newPassword })
    .where(eq(users.email, 'rrrdias25@gmail.com'));
    
  console.log('Senha atualizada com sucesso para rrrdias25@gmail.com!');
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
