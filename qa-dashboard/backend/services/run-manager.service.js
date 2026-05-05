'use strict';

const testmoService = require('./testmo.service');
const logger = require('./logger.service');
const PROJECTS = require('../config/projects.config');

function isResultPristine(result) {
  if (result.status_id !== null && result.status_id !== undefined) return false;
  if (result.elapsed && result.elapsed > 0) return false;
  if (result.comment && result.comment.trim().length > 0) return false;
  const steps = result.custom_steps_results || [];
  const hasStepData = steps.some(
    (s) =>
      (s.actual_result && s.actual_result.trim().length > 0) ||
      (s.status_id !== null && s.status_id !== undefined)
  );
  if (hasStepData) return false;
  return true;
}

function computeMergePreview(existingResults, syncCaseIds) {
  const existingMap = new Map(existingResults.map((r) => [r.case_id, r]));
  const syncSet = new Set(syncCaseIds);

  const toAdd = syncCaseIds.filter((id) => !existingMap.has(id));
  const pristineInRun = [];
  const testedInRun = [];
  const inRunNotInSync = [];

  for (const [caseId, result] of existingMap) {
    const pristine = isResultPristine(result);
    if (syncSet.has(caseId)) {
      pristine ? pristineInRun.push(caseId) : testedInRun.push(caseId);
    } else {
      inRunNotInSync.push(caseId);
      if (!pristine) testedInRun.push(caseId);
    }
  }

  const allFinalCaseIds = [...existingResults.map((r) => r.case_id), ...toAdd];

  return { toAdd, pristineInRun, testedInRun, inRunNotInSync, allFinalCaseIds };
}

function resolveProject(syncProjectId) {
  const project = PROJECTS.find((p) => p.id === syncProjectId);
  if (!project) throw new Error(`Projet inconnu : "${syncProjectId}"`);
  return {
    testmoProjectId: project.testmo.projectId,
    rootFolderId: project.testmo.rootFolderId,
  };
}

async function getFolderCases(syncProjectId, iterationName) {
  const { testmoProjectId } = resolveProject(syncProjectId);
  const folder = await testmoService.findFolder(testmoProjectId, iterationName, null);
  if (!folder) {
    throw new Error(`Dossier Testmo introuvable pour l'itération "${iterationName}"`);
  }
  const cases = await testmoService.getCases(testmoProjectId, folder.id, null);
  return {
    folderId: folder.id,
    folderName: folder.name,
    caseIds: cases.map((c) => c.id),
  };
}

async function getProjectRunsList(syncProjectId, activeOnly = true) {
  const { testmoProjectId } = resolveProject(syncProjectId);
  const data = await testmoService.getProjectRuns(testmoProjectId, activeOnly);
  const runs = data.result || [];
  return runs.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    isClosed: r.is_closed,
  }));
}

async function createRunFromCases(syncProjectId, name, caseIds, milestoneId = null) {
  const { testmoProjectId } = resolveProject(syncProjectId);
  const created = await testmoService.createRun(testmoProjectId, { name, caseIds, milestoneId });
  logger.info(`RunManager: Run créé — id=${created.id} name="${name}" cases=${caseIds.length}`);
  return created;
}

async function mergeRunCases(runId, syncCaseIds) {
  const existingResults = await testmoService.getAllRunResults(runId);
  const preview = computeMergePreview(existingResults, syncCaseIds);

  if (preview.toAdd.length === 0) {
    logger.info(`RunManager: Merge run=${runId} — aucun cas à ajouter`);
    return { added: 0, preserved: preview.testedInRun.length, preview };
  }

  await testmoService.updateRunCaseIds(runId, preview.allFinalCaseIds);
  logger.info(
    `RunManager: Merge run=${runId} — ${preview.toAdd.length} ajoutés, ${preview.testedInRun.length} préservés`
  );
  return { added: preview.toAdd.length, preserved: preview.testedInRun.length, preview };
}

module.exports = {
  isResultPristine,
  computeMergePreview,
  resolveProject,
  getFolderCases,
  getProjectRunsList,
  createRunFromCases,
  mergeRunCases,
};
