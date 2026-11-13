import { AvaSyncService } from './ava-sync.service';

describe('AvaSyncService (Moodle Sync & Deduplication)', () => {
  let service: AvaSyncService;
  let db: any;

  beforeEach(() => {
    db = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockResolvedValue({}),
    };

    service = new AvaSyncService(db);
  });

  it('should deduplicate progress items using fallback studentKey without collisions', async () => {
    const mockItems = [
      {
        aluno_id: '101',
        matricula: 'M101',
        curso: 'Direito',
        progresso_total: '50',
      },
      {
        aluno_id: '101',
        matricula: 'M101',
        curso: 'Direito',
        progresso_total: '60',
      }, // Duplicate of student 101 in same course
      {
        aluno_id: '',
        matricula: 'M102',
        curso: 'Direito',
        progresso_total: '70',
      }, // Student with empty aluno_id but valid matricula
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify(mockItems)),
    }) as any;

    const result = await service.syncProgress(
      'ead',
      'http://fake-url/progress',
      undefined,
    );

    expect(result.status).toBe('success');
    expect(db.values).toHaveBeenCalled();
    const insertedItems = db.values.mock.calls[0][0];
    expect(insertedItems).toHaveLength(2); // 2 distinct students
    expect(insertedItems[0].alunoId).toBe('101');
    expect(insertedItems[1].alunoId).toBe('M102');
  });

  it('should mark unreturned progress records as Cancelado and update consolidated snapshot without deleting history', async () => {
    db.execute = jest.fn().mockResolvedValue([]);

    const mockItems = [
      {
        aluno_id: '201',
        matricula: 'M201',
        curso: 'Engenharia',
        progresso_total: '80',
      },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify(mockItems)),
    }) as any;

    const result = await service.syncProgress(
      'ead',
      'http://fake-url/progress',
      undefined,
    );

    expect(result.status).toBe('success');
    // 1) UPDATE ava_progress_report SET enrolment_status = 'Cancelado', 2) INSERT INTO ava_consolidated_report ... ON CONFLICT DO UPDATE
    expect(db.execute).toHaveBeenCalledTimes(2);
  });
});
