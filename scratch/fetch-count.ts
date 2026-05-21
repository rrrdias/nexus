import fetch from 'node-fetch';

const url = 'https://ava.faculdaderaizes.edu.br/webservice/pluginfile.php/1/block_reports/def_report_json/22/dfr.json?token=f6ac075f09ce63f60a51b019cae2adcd';

async function check() {
  console.log("Fetching from Moodle...");
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("HTTP error:", res.status);
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error("Data is not an array:", data);
      return;
    }
    console.log("Total records fetched from Moodle JSON:", data.length);
    
    let missingMatricula = 0;
    let missingCurso = 0;
    let enrolmentStatuses: Record<string, number> = {};
    
    for (const item of data as any[]) {
      if (!item.matricula) missingMatricula++;
      if (!item.curso) missingCurso++;
      
      const status = item.enrolment_status || 'missing';
      enrolmentStatuses[status] = (enrolmentStatuses[status] || 0) + 1;
    }
    
    console.log("Missing matricula:", missingMatricula);
    console.log("Missing curso:", missingCurso);
    console.log("Enrolment status distribution in Moodle JSON:", enrolmentStatuses);
    
  } catch (err) {
    console.error("Error:", err);
  }
}

check();
