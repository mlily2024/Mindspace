/**
 * Tests for the Chronos forecast endpoint controller (GET /api/predictions/v2/forecast).
 * The forecasting logic + fallback is covered by chronosService.test.js; here we
 * only check the controller shapes the response correctly and forwards errors.
 */
jest.mock('../src/services/chronosService', () => ({ generatePredictions: jest.fn() }));
jest.mock('../src/services/predictiveEngineService', () => ({}));
jest.mock('../src/config/logger', () => ({ info: jest.fn(), error: jest.fn() }));

const chronosService = require('../src/services/chronosService');
const controller = require('../src/controllers/predictionController');

function mockRes() {
  return { json: jest.fn(), status: jest.fn().mockReturnThis() };
}

describe('predictionController.getForecast', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the forecast array with its source', async () => {
    const forecast = [
      { date: '2026-06-24', predictedMood: 6, confidenceInterval: { low: 4, high: 8 }, source: 'chronos' },
    ];
    chronosService.generatePredictions.mockResolvedValue(forecast);
    const res = mockRes();
    await controller.getForecast({ user: { userId: 'u1' }, query: { days: '5' } }, res, jest.fn());
    expect(chronosService.generatePredictions).toHaveBeenCalledWith('u1', 5);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { source: 'chronos', forecast } });
  });

  it('defaults to 7 days and reports the fallback source on an empty result', async () => {
    chronosService.generatePredictions.mockResolvedValue([]);
    const res = mockRes();
    await controller.getForecast({ user: { userId: 'u1' }, query: {} }, res, jest.fn());
    expect(chronosService.generatePredictions).toHaveBeenCalledWith('u1', 7);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { source: 'regression_fallback', forecast: [] } });
  });

  it('passes a status object (e.g. no_model) through unchanged', async () => {
    chronosService.generatePredictions.mockResolvedValue({ status: 'no_model', message: 'none' });
    const res = mockRes();
    await controller.getForecast({ user: { userId: 'u1' }, query: {} }, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { status: 'no_model', message: 'none' } });
  });

  it('forwards errors to next', async () => {
    const err = new Error('boom');
    chronosService.generatePredictions.mockRejectedValue(err);
    const next = jest.fn();
    await controller.getForecast({ user: { userId: 'u1' }, query: {} }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
