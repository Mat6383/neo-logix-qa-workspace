const { z } = require('zod');

// ─── Params ────────────────────────────────────────────────────────────────
const projectIdParam = z.object({
  projectId: z.coerce.number().int().positive('Project ID invalide')
});

const syncProjectIdParam = z.object({
  projectId: z.string().min(1, 'Project ID invalide')
});

const runIdParam = z.object({
  runId: z.coerce.number().int().positive('Run ID invalide')
});

const iterationIdParam = z.object({
  iterationId: z.coerce.number().int().positive('iterationId invalide')
});

const iidParam = z.object({
  iid: z.coerce.number().int().positive('iid invalide')
});

// ─── Body ──────────────────────────────────────────────────────────────────
const syncPreviewBody = z.object({
  projectId: z.string().min(1, '"projectId" requis'),
  iterationName: z.string().min(1, '"iterationName" requis')
});

const syncExecuteBody = syncPreviewBody;

const syncIterationBody = z.object({
  iteration: z.string().min(1, 'Paramètre "iteration" requis'),
  isTest: z.boolean().optional(),
  dryRun: z.boolean().optional()
});

const syncStatusToGitlabBody = z.object({
  runId: z.number().int().positive('"runId" requis'),
  iterationName: z.string().min(1, '"iterationName" requis'),
  gitlabProjectId: z.union([z.string(), z.number()], '"gitlabProjectId" requis'),
  dryRun: z.boolean().optional(),
  version: z.string().optional()
});

const reportsGenerateBody = z.object({
  projectId: z.number().int().positive('"projectId" requis'),
  milestoneId: z.number().int().positive('"milestoneId" requis'),
  formats: z.object({
    html: z.boolean().optional(),
    pptx: z.boolean().optional()
  }).refine(v => v.html || v.pptx, {
    message: 'Au moins un format (html/pptx) requis'
  }),
  recommendations: z.string().optional()
});

const crosstestCommentBody = z.object({
  issue_iid: z.number().int().positive('"issue_iid" requis'),
  comment: z.string().min(1, '"comment" requis'),
  milestone_context: z.string().nullable().optional()
});

const crosstestCommentPutBody = z.object({
  comment: z.string().min(1, '"comment" requis'),
  milestone_context: z.string().nullable().optional()
});

const autoConfigBody = z.object({
  enabled: z.boolean().optional(),
  runId: z.number().int().positive().optional(),
  iterationName: z.string().optional(),
  gitlabProjectId: z.string().optional(),
  version: z.string().optional()
}).refine(v => Object.keys(v).length > 0, {
  message: 'Aucun champ valide fourni (enabled, runId, iterationName, gitlabProjectId, version)'
});

// ─── Middleware ────────────────────────────────────────────────────────────
function validate(schema) {
  return (req, res, next) => {
    try {
      schema.parse(req);
      next();
    } catch (err) {
      const message = err.errors?.[0]?.message || err.message;
      return res.status(400).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString()
      });
    }
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    try {
      schema.parse(req.params);
      next();
    } catch (err) {
      const message = err.errors?.[0]?.message || err.message;
      return res.status(400).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString()
      });
    }
  };
}

function validateBody(schema) {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err) {
      const message = err.errors?.[0]?.message || err.message;
      return res.status(400).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString()
      });
    }
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    try {
      schema.parse(req.query);
      next();
    } catch (err) {
      const message = err.errors?.[0]?.message || err.message;
      return res.status(400).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString()
      });
    }
  };
}

module.exports = {
  z,
  validate,
  validateParams,
  validateBody,
  validateQuery,
  projectIdParam,
  syncProjectIdParam,
  runIdParam,
  iterationIdParam,
  iidParam,
  syncPreviewBody,
  syncExecuteBody,
  syncIterationBody,
  syncStatusToGitlabBody,
  reportsGenerateBody,
  crosstestCommentBody,
  crosstestCommentPutBody,
  autoConfigBody
};
