import fetch from 'node-fetch';

const url = 'https://ava.faculdaderaizes.edu.br/webservice/pluginfile.php/1/block_reports/def_report_json/22/dfr.json?token=f6ac075f09ce63f60a51b019cae2adcd';

async function run() {
  const res = await fetch(url);
  const data = (await res.json()) as any[];
  
  const targetKey = 'R2510024_METODOLOGIA DO TRABALHO CIENTÍFICO - ON-LINE - R02650053-INT-A20252';
  
  const matches = data.filter(item => `${item.matricula}_${item.curso}` === targetKey);
  console.log(`Found ${matches.length} matches for key:`);
  console.log(JSON.stringify(matches, null, 2));
}

run().catch(console.error);
