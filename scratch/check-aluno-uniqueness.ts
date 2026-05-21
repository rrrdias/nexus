import fetch from 'node-fetch';

const url = 'https://ava.faculdaderaizes.edu.br/webservice/pluginfile.php/1/block_reports/def_report_json/22/dfr.json?token=f6ac075f09ce63f60a51b019cae2adcd';

async function run() {
  const res = await fetch(url);
  const data = (await res.json()) as any[];
  console.log("Total records fetched from Moodle:", data.length);

  const seen = new Set<string>();
  const dupes: string[] = [];

  for (const item of data) {
    const key = `${item.aluno_id}_${item.curso}`;
    if (seen.has(key)) {
      dupes.push(key);
    } else {
      seen.add(key);
    }
  }

  console.log("Unique (aluno_id, curso) combinations:", seen.size);
  console.log("Duplicate combinations:", dupes.length);
}

run().catch(console.error);
