import { db } from './index';
import { avaOpenlms } from './schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('🌱 Semeando credenciais Moodle corretas (64-char Conduit tokens) na tabela ava_openlms...');

  const data = [
    {
      unidadeEns: 'UniEVANGÉLICA',
      urlSandbox: 'unievangelica-sandbox.myopenlms.net',
      tokenSandbox: 'JB0lPNK5bHuGZynaGpNL75fUEB7I4YoDZfpot1jL8URXJ6xPlBbi773B90K3Oz7n',
      urlProd: 'avagrad.unievangelica.edu.br',
      tokenProd: 'Jtmko5WBb1PTNSwHjThcYNtrPlhRZ05ijiJNdgP5XgPkzBrYWP1udldtNABm06La',
      status: true,
    },
    {
      unidadeEns: 'EaD',
      urlSandbox: 'avaead-unievangelica-sandbox.myopenlms.net',
      tokenSandbox: '7Wynfa7j3P1seisFkEMkf0fZFkBAcQ5ZmtDIKArDPjwuHf1skDSF4ze9agA2y6Ra',
      urlProd: 'avaead.unievangelica.edu.br',
      tokenProd: '7Wynfa7j3P1seisFkEMkf0fZFkBAcQ5ZmtDIKArDPjwuHf1skDSF4ze9agA2y6Ra',
      status: true,
    },
    {
      unidadeEns: 'Ead_Unievangelica',
      urlSandbox: 'avaead-unievangelica-sandbox.myopenlms.net',
      tokenSandbox: '7Wynfa7j3P1seisFkEMkf0fZFkBAcQ5ZmtDIKArDPjwuHf1skDSF4ze9agA2y6Ra',
      urlProd: 'avaead.unievangelica.edu.br',
      tokenProd: '7Wynfa7j3P1seisFkEMkf0fZFkBAcQ5ZmtDIKArDPjwuHf1skDSF4ze9agA2y6Ra',
      status: true,
    },
    {
      unidadeEns: 'FAEGO',
      urlSandbox: 'faceg-sandbox.myopenlms.net',
      tokenSandbox: 'JhbOfQpjF1W82qPj9ihjyukcglLWaeLjCmyh4dGAUc8MJNxIwTrjERCl3N7TsJ3u',
      urlProd: 'ava.uniego.edu.br',
      tokenProd: 'JhbOfQpjF1W82qPj9ihjyukcglLWaeLjCmyh4dGAUc8MJNxIwTrjERCl3N7TsJ3u',
      status: true,
    },
    {
      unidadeEns: 'RAÍZES',
      urlSandbox: 'raizes-sandbox.myopenlms.net',
      tokenSandbox: '9K1lgXx7sSlzBT9W7atH7xljZ1Tz07Q0HHboeOmMhNCiiC5gdonabPA0GUp6R6xa',
      urlProd: 'ava.faculdaderaizes.edu.br',
      tokenProd: '9K1lgXx7sSlzBT9W7atH7xljZ1Tz07Q0HHboeOmMhNCiiC5gdonabPA0GUp6R6xa',
      status: true,
    },
    {
      unidadeEns: 'RAIZES',
      urlSandbox: 'raizes-sandbox.myopenlms.net',
      tokenSandbox: '9K1lgXx7sSlzBT9W7atH7xljZ1Tz07Q0HHboeOmMhNCiiC5gdonabPA0GUp6R6xa',
      urlProd: 'ava.faculdaderaizes.edu.br',
      tokenProd: '9K1lgXx7sSlzBT9W7atH7xljZ1Tz07Q0HHboeOmMhNCiiC5gdonabPA0GUp6R6xa',
      status: true,
    },
    {
      unidadeEns: 'EEFN',
      urlSandbox: 'colegiosaee-sandbox.myopenlms.net',
      tokenSandbox: '37KzpACjJEKDhHPEEeJCioxtaIeJbASU8eKneMNnRYrzg73kbDn9sasIjMRBNkWM',
      urlProd: 'ava.aee.edu.br',
      tokenProd: '37KzpACjJEKDhHPEEeJCioxtaIeJbASU8eKneMNnRYrzg73kbDn9sasIjMRBNkWM',
      status: true,
    },
  ];

  for (const item of data) {
    try {
      const existing = await db.select().from(avaOpenlms).where(eq(avaOpenlms.unidadeEns, item.unidadeEns));
      if (existing.length > 0) {
        await db.update(avaOpenlms)
          .set(item)
          .where(eq(avaOpenlms.unidadeEns, item.unidadeEns));
        console.log(`[SEED] Atualizadas credenciais para a unidade: "${item.unidadeEns}"`);
      } else {
        await db.insert(avaOpenlms).values(item);
        console.log(`[SEED] Inseridas credenciais para a unidade: "${item.unidadeEns}"`);
      }
    } catch (e: any) {
      console.error(`Erro ao semear "${item.unidadeEns}":`, e.message);
    }
  }

  console.log('✅ Semeamento de credenciais Moodle concluído!');
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
