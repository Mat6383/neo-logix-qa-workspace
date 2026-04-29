'use strict';

const request = require('supertest');

jest.mock('../../services/gitlab.service', () => ({
  searchIterations: jest.fn().mockResolvedValue([]),
  getIssuesByLabelAndIterationForProject: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/comments.service', () => ({
  getAll: jest.fn().mockReturnValue({}),
  upsert: jest
    .fn()
    .mockReturnValue({ id: 1, issue_iid: 1, comment: 'test', milestone_context: null }),
  delete: jest.fn().mockReturnValue(true),
}));

const app = require('../../server');

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('GET /api/crosstest/iterations', () => {
  test('200 — liste des itérations', async () => {
    const res = await request(app).get('/api/crosstest/iterations');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/crosstest/issues/:iterationId', () => {
  test('400 — iterationId non numérique', async () => {
    const res = await request(app).get('/api/crosstest/issues/abc');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — iterationId zéro', async () => {
    const res = await request(app).get('/api/crosstest/issues/0');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — iterationId valide', async () => {
    const res = await request(app).get('/api/crosstest/issues/42');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/crosstest/comments', () => {
  test('200 — retourne tous les commentaires', async () => {
    const res = await request(app).get('/api/crosstest/comments');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('POST /api/crosstest/comments', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/crosstest/comments')
      .send({ issue_iid: 1, comment: 'test' });
    expect(res.status).toBe(403);
  });

  test('400 — issue_iid manquant', async () => {
    const res = await request(app)
      .post('/api/crosstest/comments')
      .set(CSRF)
      .send({ comment: 'test' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — comment vide', async () => {
    const res = await request(app)
      .post('/api/crosstest/comments')
      .set(CSRF)
      .send({ issue_iid: 1, comment: '' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — body valide', async () => {
    const res = await request(app)
      .post('/api/crosstest/comments')
      .set(CSRF)
      .send({ issue_iid: 1, comment: 'Tout bon' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('PUT /api/crosstest/comments/:iid', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app).put('/api/crosstest/comments/1').send({ comment: 'updated' });
    expect(res.status).toBe(403);
  });

  test('400 — iid non numérique', async () => {
    const res = await request(app)
      .put('/api/crosstest/comments/abc')
      .set(CSRF)
      .send({ comment: 'updated' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — comment vide', async () => {
    const res = await request(app).put('/api/crosstest/comments/1').set(CSRF).send({ comment: '' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — body valide', async () => {
    const res = await request(app)
      .put('/api/crosstest/comments/1')
      .set(CSRF)
      .send({ comment: 'updated comment' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('DELETE /api/crosstest/comments/:iid', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app).delete('/api/crosstest/comments/1');
    expect(res.status).toBe(403);
  });

  test('400 — iid non numérique', async () => {
    const res = await request(app).delete('/api/crosstest/comments/abc').set(CSRF);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — iid valide', async () => {
    const res = await request(app).delete('/api/crosstest/comments/1').set(CSRF);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
