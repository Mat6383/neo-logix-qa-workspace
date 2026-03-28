/**
 * ================================================
 * SYNC SERVICE - GitLab → Testmo Pipeline
 * ================================================
 * Synchronise les tickets GitLab (label + itération) vers
 * le repository de test cases Testmo.
 *
 * Flux LEAN : Pull automatique, idempotent, anti-Muda
 * ISTQB FL 4.2 : Test Conditions → Test Cases
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

const logger = require('./logger.service');
const testmoService = require('./testmo.service');
const gitlabService = require('./gitlab.service');
const { marked } = require('marked');

class SyncService {
  constructor() {
    this.projectId = parseInt(process.env.TESTMO_PROJECT_ID) || 1;
    this.rootGroupId = parseInt(process.env.TESTMO_ROOT_GROUP_ID) || null;
    this.gitlabLabel = process.env.GITLAB_LABEL || 'test::TODO';
    this.apiDelay = 300;
    // Testmo GitLab integration IDs (discovered via API probing)
    this.gitlabIntegrationId = parseInt(process.env.TESTMO_GITLAB_INTEGRATION_ID) || 1;
    this.gitlabConnectionProjectId = parseInt(process.env.TESTMO_GITLAB_CONNECTION_PROJECT_ID) || 10684795;
  }

  /**
   * Pause entre requêtes API
   */
  _delay() {
    return new Promise(resolve => setTimeout(resolve, this.apiDelay));
  }

  /**
   * Parse le nom d'itération pour extraire le dossier parent et sous-dossier
   * Ex: "R06-run1" ou "R06 - run 1" → { parent: "R06", child: "R06 - run 1" }
   *
   * @param {string} iterationName - Nom brut de l'itération
   * @returns {{ parent: string, child: string }}
   */
  parseIterationName(iterationName) {
    // Normalise les espaces autour du tiret
    const normalized = iterationName.replace(/\s*-\s*/, ' - ').trim();

    // Split sur " - " pour séparer R06 de run 1
    const parts = normalized.split(' - ');
    const parent = parts[0].trim(); // "R06"

    return {
      parent,
      child: normalized // "R06 - run 1"
    };
  }

  /**
   * Crée l'arborescence de dossiers dans Testmo
   * Ex: TESTS ISSUES (root) > [TEST-API] R06 > R06 - run 1
   *
   * @param {string} iterationName - Nom de l'itération
   * @param {boolean} isTest - Si true, préfixe [TEST-API]
   * @returns {{ parentFolder: Object, childFolder: Object }}
   */
  async ensureFolderHierarchy(iterationName, isTest = false) {
    const { parent, child } = this.parseIterationName(iterationName);
    const parentName = isTest ? `[TEST-API] ${parent}` : parent;

    logger.info(`Sync: Création arborescence — "${parentName}" > "${child}"`);

    // 1. Créer/récupérer le dossier parent sous la racine (group_id=4514)
    const parentFolder = await testmoService.getOrCreateFolder(
      this.projectId,
      parentName,
      this.rootGroupId
    );
    await this._delay();

    // 2. Créer/récupérer le sous-dossier
    const childFolder = await testmoService.getOrCreateFolder(
      this.projectId,
      child,
      parentFolder.id
    );

    return { parentFolder, childFolder };
  }

  /**
   * Construit le payload Testmo à partir d'un ticket GitLab
   *
   * @param {Object} issue - Ticket GitLab
   * @param {number} folderId - ID du folder Testmo cible
   * @param {string} iterationName - Nom de l'itération (pour le tag)
   * @returns {Object} Payload Testmo
   */
  buildCasePayload(issue, folderId, iterationName) {
    const iid = issue.iid;
    const title = issue.title || '';
    const description = issue.description || '';

    // Tags : sync marker uniquement (itération = nom du dossier, IID = champ Issues)
    const tags = ['sync-auto'];

    // Estimate : GitLab time_estimate (secondes) → format Testmo
    const estimate = gitlabService.constructor.formatEstimate(issue.time_stats?.time_estimate || 0);

    const payload = {
      name: title,
      folder_id: folderId,
      tags,
      custom_description: description ? marked.parse(description.substring(0, 4000)) : '',
      // Lien natif GitLab → Testmo Issues (remplace le tag gitlab-IID)
      issues: [{
        display_id: String(iid),
        integration_id: this.gitlabIntegrationId,
        connection_project_id: this.gitlabConnectionProjectId
      }]
    };

    if (estimate) {
      payload.estimate = estimate;
    }

    return payload;
  }

  /**
   * Pipeline principal de synchronisation
   * LEAN : flux pull, idempotent, anti-Muda
   *
   * @param {string} iterationName - Nom de l'itération (ex: "R06 - run 1")
   * @param {Object} options
   * @param {boolean} options.isTest - Mode test (préfixe [TEST-API])
   * @param {boolean} options.dryRun - Mode simulation (pas d'écriture)
   * @returns {Object} Rapport de synchronisation
   */
  async syncIteration(iterationName, options = {}) {
    const { isTest = false, dryRun = false } = options;
    const stats = { created: 0, updated: 0, skipped: 0, enriched: 0, errors: 0, total: 0 };

    logger.info('='.repeat(60));
    logger.info(`Sync: Démarrage synchronisation GitLab → Testmo`);
    logger.info(`Sync: Itération="${iterationName}" | Label="${this.gitlabLabel}" | Test=${isTest} | DryRun=${dryRun}`);
    logger.info('='.repeat(60));

    try {
      // 1. Rechercher l'itération dans GitLab
      logger.info('Sync: [1/4] Recherche itération GitLab...');
      const iteration = await gitlabService.findIteration(iterationName);
      if (!iteration) {
        return { ...stats, error: `Itération "${iterationName}" non trouvée dans GitLab` };
      }
      await this._delay();

      // 2. Récupérer les tickets
      logger.info('Sync: [2/4] Récupération tickets GitLab...');
      const issues = await gitlabService.getIssuesByLabelAndIteration(
        this.gitlabLabel,
        iteration.id
      );
      stats.total = issues.length;

      if (issues.length === 0) {
        logger.info('Sync: Aucun ticket trouvé — rien à synchroniser');
        return stats;
      }
      await this._delay();

      // 3. Créer l'arborescence Testmo
      logger.info('Sync: [3/4] Création arborescence Testmo...');
      const { childFolder } = await this.ensureFolderHierarchy(iterationName, isTest);
      await this._delay();

      // 4. Synchroniser chaque ticket
      logger.info(`Sync: [4/4] Synchronisation de ${issues.length} ticket(s)...`);

      for (const issue of issues) {
        try {
          const iid = issue.iid;

          // Vérifier si le case existe déjà (idempotence par nom)
          const existingCase = await testmoService.findCaseByName(
            this.projectId,
            issue.title,
            childFolder.id
          );
          await this._delay();

          if (existingCase) {
            // Vérifier si enrichi manuellement
            if (testmoService.isCaseEnriched(existingCase)) {
              logger.info(`Sync: Case #${iid} "${issue.title}" — ENRICHI, skip`);
              stats.enriched++;
              stats.skipped++;
              continue;
            }

            // Mettre à jour
            if (!dryRun) {
              const payload = this.buildCasePayload(issue, childFolder.id, iterationName);
              await testmoService.updateCase(this.projectId, existingCase.id, payload);
            }
            logger.info(`Sync: Case #${iid} "${issue.title}" — MIS À JOUR`);
            stats.updated++;
          } else {
            // Créer
            if (!dryRun) {
              const payload = this.buildCasePayload(issue, childFolder.id, iterationName);
              await testmoService.createCase(this.projectId, payload);
            }
            logger.info(`Sync: Case #${iid} "${issue.title}" — CRÉÉ`);
            stats.created++;
          }

          await this._delay();
        } catch (err) {
          logger.error(`Sync: Erreur sur ticket #${issue.iid} "${issue.title}":`, err.message);
          stats.errors++;
        }
      }

      // Rapport
      logger.info('='.repeat(60));
      logger.info('RAPPORT DE SYNCHRONISATION');
      logger.info(`  Créés     : ${stats.created}`);
      logger.info(`  Mis à jour: ${stats.updated}`);
      logger.info(`  Enrichis  : ${stats.enriched} (non modifiés)`);
      logger.info(`  Erreurs   : ${stats.errors}`);
      logger.info(`  Total     : ${stats.total}`);
      logger.info('='.repeat(60));

      return stats;

    } catch (error) {
      logger.error('Sync: Erreur fatale:', error.message);
      return { ...stats, error: error.message };
    }
  }

  /**
   * Test de connectivité Testmo — crée un dossier de test et le vérifie
   *
   * @returns {Object} Résultat du test
   */
  async testTestmoApi() {
    const results = { folders: null, cases: null, cleanup: null };

    try {
      logger.info('='.repeat(60));
      logger.info('TEST API TESTMO — Validation des endpoints beta');
      logger.info('='.repeat(60));

      // 1. Lister les folders existants sous la racine
      logger.info('[1/5] Listage des folders sous group_id=' + this.rootGroupId);
      const existingFolders = await testmoService.getFolders(this.projectId, this.rootGroupId);
      logger.info(`  → ${existingFolders.length} folder(s) trouvé(s)`);
      results.folders = { existing: existingFolders.map(f => ({ id: f.id, name: f.name })) };
      await this._delay();

      // 2. Créer un folder de test
      logger.info('[2/5] Création folder "[TEST-API] R06"');
      const testParent = await testmoService.getOrCreateFolder(
        this.projectId,
        '[TEST-API] R06',
        this.rootGroupId
      );
      results.folders.testParent = { id: testParent.id, name: testParent.name };
      await this._delay();

      // 3. Créer un sous-folder
      logger.info('[3/5] Création sous-folder "R06 - run 1"');
      const testChild = await testmoService.getOrCreateFolder(
        this.projectId,
        'R06 - run 1',
        testParent.id
      );
      results.folders.testChild = { id: testChild.id, name: testChild.name };
      await this._delay();

      // 4. Créer un case de test
      logger.info('[4/5] Création case de test');
      const testCase = await testmoService.createCase(this.projectId, {
        name: '[TEST-API] Cas de test automatique',
        folder_id: testChild.id,
        tags: ['gitlab-9999', 'iteration-r06-run-1', 'sync-auto'],
        custom_description: '<p>Test automatique via API — à supprimer</p>',
        estimate: '15m'
      });
      results.cases = { created: { id: testCase.id, name: testCase.name || '[TEST-API] Cas de test automatique' } };
      await this._delay();

      // 5. Vérifier l'idempotence (recherche par nom)
      logger.info('[5/5] Vérification idempotence (recherche par nom)');
      const found = await testmoService.findCaseByName(this.projectId, '[TEST-API] Cas de test automatique', testChild.id);
      results.cases.idempotenceCheck = found ? `OK — case retrouvé par nom (id=${found.id})` : 'FAIL — case non retrouvé';

      logger.info('='.repeat(60));
      logger.info('TEST API TESTMO — TERMINÉ');
      logger.info(JSON.stringify(results, null, 2));
      logger.info('='.repeat(60));

      return { success: true, results };

    } catch (error) {
      logger.error('TEST API TESTMO — ERREUR:', error.message);
      return { success: false, error: error.message, results };
    }
  }

  /**
   * Nettoyage du dossier de test
   */
  async cleanupTestFolder() {
    try {
      const testFolder = await testmoService.findFolder(
        this.projectId,
        '[TEST-API] R06',
        this.rootGroupId
      );
      if (testFolder) {
        await testmoService.deleteFolders(this.projectId, [testFolder.id]);
        logger.info('Sync: Dossier [TEST-API] R06 supprimé');
        return { success: true, deleted: testFolder.id };
      }
      return { success: true, message: 'Dossier non trouvé, rien à supprimer' };
    } catch (error) {
      logger.error('Cleanup error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SyncService();
