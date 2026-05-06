/**
 * Tests unitaires pour auto-sync-config.service.js
 * Le module utilise un état global _config — on réinitialise le registre
 * entre chaque groupe de tests avec jest.resetModules() pour isoler les états.
 */

jest.mock('fs');
jest.mock('../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('auto-sync-config.service — getConfig', () => {
  let fs;
  let service;

  beforeEach(() => {
    jest.resetModules();
    fs = require('fs');
    fs.existsSync.mockReturnValue(false);
    service = require('../services/auto-sync-config.service');
  });

  it('retourne les defaults quand aucun fichier JSON', () => {
    const cfg = service.getConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.runId).toBeNull();
    expect(cfg.iterationName).toBe('');
    expect(cfg.gitlabProjectId).toBe('');
  });

  it('retourne une copie — pas la même référence', () => {
    const c1 = service.getConfig();
    const c2 = service.getConfig();
    expect(c1).not.toBe(c2);
    expect(c1).toEqual(c2);
  });

  it('lit depuis le fichier JSON quand il existe', () => {
    jest.resetModules();
    fs = require('fs');
    const saved = {
      enabled: true,
      runId: 42,
      iterationName: 'R14',
      gitlabProjectId: '99',
      version: '2.0',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(saved));
    service = require('../services/auto-sync-config.service');
    const cfg = service.getConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.runId).toBe(42);
    expect(cfg.iterationName).toBe('R14');
  });

  it('fallback sur defaults si le fichier JSON est corrompu', () => {
    jest.resetModules();
    fs = require('fs');
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('not valid json {{{');
    service = require('../services/auto-sync-config.service');
    const cfg = service.getConfig();
    expect(cfg.enabled).toBe(false);
  });
});

describe('auto-sync-config.service — updateConfig', () => {
  let fs;
  let service;

  beforeEach(() => {
    jest.resetModules();
    fs = require('fs');
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync = jest.fn();
    fs.writeFileSync = jest.fn();
    service = require('../services/auto-sync-config.service');
  });

  it('met à jour enabled', () => {
    service.updateConfig({ enabled: true });
    expect(service.getConfig().enabled).toBe(true);
  });

  it('met à jour runId', () => {
    service.updateConfig({ runId: 123 });
    expect(service.getConfig().runId).toBe(123);
  });

  it('met à jour iterationName', () => {
    service.updateConfig({ iterationName: 'R15' });
    expect(service.getConfig().iterationName).toBe('R15');
  });

  it('ignore les champs non-autorisés', () => {
    service.updateConfig({ malicious: 'hack', enabled: true });
    expect(service.getConfig().malicious).toBeUndefined();
    expect(service.getConfig().enabled).toBe(true);
  });

  it('met à jour updatedAt automatiquement', () => {
    service.updateConfig({ enabled: true });
    expect(service.getConfig().updatedAt).toBeTruthy();
    expect(typeof service.getConfig().updatedAt).toBe('string');
  });

  it('persiste via writeFileSync', () => {
    service.updateConfig({ enabled: true });
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
  });

  it('retourne la config mise à jour', () => {
    const result = service.updateConfig({ runId: 99 });
    expect(result.runId).toBe(99);
  });

  it('ne modifie pas les champs non fournis', () => {
    service.updateConfig({ runId: 5 });
    expect(service.getConfig().iterationName).toBe('');
  });
});

describe('auto-sync-config.service — validate', () => {
  let fs;
  let service;

  beforeEach(() => {
    jest.resetModules();
    fs = require('fs');
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync = jest.fn();
    fs.writeFileSync = jest.fn();
    service = require('../services/auto-sync-config.service');
  });

  it('invalid si enabled=false (config par défaut)', () => {
    const { valid, errors } = service.validate();
    expect(valid).toBe(false);
    expect(errors).toContain('Auto-sync désactivé (enabled=false)');
  });

  it('invalid si runId manquant', () => {
    service.updateConfig({ enabled: true });
    const { errors } = service.validate();
    expect(errors.some(e => e.includes('runId'))).toBe(true);
  });

  it('invalid si iterationName manquant', () => {
    service.updateConfig({ enabled: true, runId: 1 });
    const { errors } = service.validate();
    expect(errors.some(e => e.includes('iterationName'))).toBe(true);
  });

  it('invalid si gitlabProjectId manquant', () => {
    service.updateConfig({ enabled: true, runId: 1, iterationName: 'R14' });
    const { errors } = service.validate();
    expect(errors.some(e => e.includes('gitlabProjectId'))).toBe(true);
  });

  it('valid quand tous les champs requis sont présents', () => {
    service.updateConfig({ enabled: true, runId: 1, iterationName: 'R14', gitlabProjectId: '99' });
    const { valid, errors } = service.validate();
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('liste 4 erreurs quand la config est complètement vide', () => {
    const { errors } = service.validate();
    expect(errors.length).toBe(4);
  });
});
