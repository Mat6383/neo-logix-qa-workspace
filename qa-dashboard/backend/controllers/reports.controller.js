const testmoService = require('../services/testmo.service');
const ReportService = require('../services/report.service');
const logger = require('../services/logger.service');

const reportService = new ReportService(testmoService);

async function generateReport(req, res) {
  try {
    const { projectId, milestoneId, formats, recommendations } = req.body;

    logger.info(`Génération rapport: project=${projectId}, milestone=${milestoneId}, formats=${JSON.stringify(formats)}`);

    const data = await reportService.collectReportData(projectId, milestoneId);
    const result = { success: true, files: {} };

    if (formats.html) {
      const htmlContent = reportService.generateHTML(data, recommendations);
      result.files.html = Buffer.from(htmlContent, 'utf-8').toString('base64');
      result.files.htmlFilename = `${data.milestoneName}_Cloture_Tests.html`;
    }

    if (formats.pptx) {
      const pres = await reportService.generatePPTX(data, recommendations);
      const pptxBuffer = await pres.write({ outputType: 'nodebuffer' });
      result.files.pptx = pptxBuffer.toString('base64');
      result.files.pptxFilename = `${data.milestoneName}_Cloture_Tests.pptx`;
    }

    result.summary = {
      milestone: data.milestoneName,
      verdict: data.verdict,
      totalTests: data.stats.totalTests,
      passRate: data.stats.passRate,
      failedTests: data.failedTests.length,
    };

    logger.info(`Rapport généré: ${data.milestoneName} — ${data.verdict}`);
    res.json(result);
  } catch (error) {
    logger.error('Erreur POST /api/reports/generate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { generateReport };
