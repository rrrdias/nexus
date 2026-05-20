import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export function ProgressoTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <div className="p-8 text-center text-[#9AA0AC] italic text-sm">Nenhum aluno encontrado para os filtros selecionados.</div>
  }

  const getStatusBadge = (status: string) => {
    if (!status) return null
    if (status.toLowerCase().includes('ativo')) return <Badge className="bg-green-brand text-navy hover:bg-green-dark">{status}</Badge>
    if (status.toLowerCase().includes('suspenso')) return <Badge variant="destructive">{status}</Badge>
    return <Badge variant="secondary">{status}</Badge>
  }

  return (
    <div className="overflow-auto max-h-[600px]">
      <Table>
        <TableHeader className="bg-gray-50/50 sticky top-0">
          <TableRow>
            <TableHead className="w-[100px]">Matrícula</TableHead>
            <TableHead>Aluno</TableHead>
            <TableHead>Disciplina</TableHead>
            <TableHead>Curso</TableHead>
            <TableHead>Polo</TableHead>
            <TableHead>Acesso</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">F1</TableHead>
            <TableHead className="text-right">F2</TableHead>
            <TableHead className="text-right">F3</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.matricula}</TableCell>
              <TableCell className="font-semibold">{row.aluno}</TableCell>
              <TableCell className="text-xs max-w-[200px] truncate" title={row.curso}>{row.curso}</TableCell>
              <TableCell className="text-xs">{row.cursoPerfil}</TableCell>
              <TableCell className="text-xs">{row.unidadeFisica}</TableCell>
              <TableCell className="text-xs">{row.lastaccess || '-'}</TableCell>
              <TableCell>{getStatusBadge(row.enrolmentStatus)}</TableCell>
              <TableCell className="text-right text-xs font-bold">{row.fase1 || '-'}</TableCell>
              <TableCell className="text-right text-xs font-bold">{row.fase2 || '-'}</TableCell>
              <TableCell className="text-right text-xs font-bold">{row.fase3 || '-'}</TableCell>
              <TableCell className="text-right text-sm font-black text-navy">{row.progressoTotal || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
