import { RequestIdMiddleware } from './request-id.middleware';
import { Request, Response } from 'express';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('should generate a new UUID and set headers when x-request-id is not provided', () => {
    const req = { headers: {} } as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    expect(next).toHaveBeenCalled();
  });

  it('should reuse provided x-request-id from headers', () => {
    const customId = 'custom-request-id-12345';
    const req = { headers: { 'x-request-id': customId } } as unknown as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.requestId).toBe(customId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', customId);
    expect(next).toHaveBeenCalled();
  });
});
