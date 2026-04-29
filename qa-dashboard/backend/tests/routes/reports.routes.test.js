'use strict';

const request = require('supertest');

jest.mock('../../controllers/reports.controller', () => ({
  generateReport: jest.fn((_req, res) =>
    res.json({ success: true, timestamp: new Date().toISOString() })
  ),
}));

const app = require('../../server');

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('POST /api/reports/generate', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .send({ projectId: 1, milestoneId: 2, formats: { html: true } });
    expect(res.status).toBe(403);
  });

  test('400 — projectId manquant', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set(CSRF)
      .send({ milestoneId: 2, formats: { html: true } });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — milestoneId manquant', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set(CSRF)
      .send({ projectId: 1, formats: { html: true } });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — formats vide (aucun format sélectionné)', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set(CSRF)
      .send({ projectId: 1, milestoneId: 2, formats: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Au moins un format (html/pptx) requis');
  });

  test('400 — projectId négatif', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set(CSRF)
      .send({ projectId: -1, milestoneId: 2, formats: { html: true } });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — body valide avec format html', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set(CSRF)
      .send({ projectId: 1, milestoneId: 2, formats: { html: true } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  test('200 — body valide avec format pptx et recommendations', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set(CSRF)
      .send({
        projectId: 1,
        milestoneId: 2,
        formats: { pptx: true },
        recommendations: 'Améliorer la couverture',
      });
    expect(res.status).toBe(200);
  });
});
