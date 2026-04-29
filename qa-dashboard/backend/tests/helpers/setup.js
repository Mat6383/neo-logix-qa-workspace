'use strict';

// Variables minimales pour que server.js passe son check REQUIRED_ENV
// sans .env (dotenv ne remplace pas les vars déjà définies)
process.env.TESTMO_URL = process.env.TESTMO_URL || 'http://mock-testmo.test';
process.env.TESTMO_TOKEN = process.env.TESTMO_TOKEN || 'mock-testmo-token';
process.env.GITLAB_URL = process.env.GITLAB_URL || 'http://mock-gitlab.test';
process.env.GITLAB_TOKEN = process.env.GITLAB_TOKEN || 'mock-gitlab-token';
process.env.NODE_ENV = 'test';
