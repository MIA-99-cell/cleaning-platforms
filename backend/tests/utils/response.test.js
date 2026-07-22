const { sendSuccess, sendError, sendPaginated } = require('../../src/utils/response');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('sendSuccess', () => {
  it('defaults to status 200 with a success envelope', () => {
    const res = mockRes();
    sendSuccess(res, { id: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Success',
      data: { id: 1 },
    });
  });

  it('honors a custom message and status code', () => {
    const res = mockRes();
    sendSuccess(res, { id: 2 }, 'Created', 201);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Created',
      data: { id: 2 },
    });
  });
});

describe('sendError', () => {
  it('defaults to status 500 with a failure envelope and no errors key', () => {
    const res = mockRes();
    sendError(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'An error occurred',
    });
  });

  it('includes the errors field when provided', () => {
    const res = mockRes();
    const errors = [{ field: 'email', msg: 'required' }];
    sendError(res, 'Validation failed', 422, errors);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors,
    });
  });
});

describe('sendPaginated', () => {
  it('computes totalPages by rounding up', () => {
    const res = mockRes();
    sendPaginated(res, [1, 2, 3], { page: 1, limit: 10, total: 25 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Success',
      data: [1, 2, 3],
      pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
    });
  });

  it('reports zero pages when there are no results', () => {
    const res = mockRes();
    sendPaginated(res, [], { page: 1, limit: 10, total: 0 });
    expect(res.json.mock.calls[0][0].pagination.totalPages).toBe(0);
  });
});
