'use strict';

// On mock les méthodes réseau du service sans toucher à la classe
const gitlab = require('../services/gitlab.service');

beforeEach(() => {
  jest.spyOn(gitlab, '_getPaginated').mockResolvedValue([]);
  jest.spyOn(gitlab, 'getIssuesForIteration').mockResolvedValue([]);
  jest.spyOn(gitlab, 'executeGraphQL').mockResolvedValue({});
  jest.spyOn(gitlab, '_delay').mockResolvedValue();
});

afterEach(() => jest.restoreAllMocks());

const makeIssue = (id) => ({ id, iid: id, title: `Issue ${id}` });

const makeGraphQLData = (issues, overrides = {}) => {
  const data = {};
  for (const iss of issues) {
    data[`wi_${iss.id}`] = {
      id: `gid://gitlab/WorkItem/${iss.id}`,
      widgets: [
        { type: 'STATUS', status: { id: overrides[iss.id]?.statusGid || null } },
        {
          customFieldValues: [
            {
              customField: { name: 'Version Prod' },
              selectedOptions: [{ value: overrides[iss.id]?.versionProd || null }],
            },
            {
              customField: { name: 'Version de test' },
              selectedOptions: [{ value: overrides[iss.id]?.versionTest || null }],
            },
          ],
        },
      ],
    };
  }
  return data;
};

describe('getIssuesByFilters', () => {
  test('sans filtre GraphQL — retourne issues REST brutes', async () => {
    const issues = [makeIssue(1), makeIssue(2)];
    gitlab._getPaginated.mockResolvedValue(issues);

    const result = await gitlab.getIssuesByFilters(63, {});

    expect(gitlab.executeGraphQL).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  test('avec iterationId — utilise getIssuesForIteration', async () => {
    const issues = [makeIssue(1)];
    gitlab.getIssuesForIteration.mockResolvedValue(issues);
    gitlab.executeGraphQL.mockResolvedValue(
      makeGraphQLData(issues, {
        1: { statusGid: 'gid://gitlab/WorkItems::Statuses::Custom::Status/15' },
      })
    );

    const result = await gitlab.getIssuesByFilters(63, {
      iterationId: 42,
      statusGid: 'gid://gitlab/WorkItems::Statuses::Custom::Status/15',
    });

    expect(gitlab.getIssuesForIteration).toHaveBeenCalledWith(63, 42);
    expect(result).toHaveLength(1);
  });

  test('filtre statusGid — exclut les issues sans le bon statut', async () => {
    const issues = [makeIssue(1), makeIssue(2)];
    gitlab._getPaginated.mockResolvedValue(issues);
    gitlab.executeGraphQL.mockResolvedValue(
      makeGraphQLData(issues, {
        1: { statusGid: 'gid://gitlab/WorkItems::Statuses::Custom::Status/15' },
        2: { statusGid: 'gid://gitlab/WorkItems::Statuses::Custom::Status/99' },
      })
    );

    const result = await gitlab.getIssuesByFilters(63, {
      statusGid: 'gid://gitlab/WorkItems::Statuses::Custom::Status/15',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  test('filtre versionProd — exclut les issues sans la bonne version', async () => {
    const issues = [makeIssue(10), makeIssue(11)];
    gitlab._getPaginated.mockResolvedValue(issues);
    gitlab.executeGraphQL.mockResolvedValue(
      makeGraphQLData(issues, {
        10: { versionProd: 'R06 - Pilot' },
        11: { versionProd: 'R07 - Prod' },
      })
    );

    const result = await gitlab.getIssuesByFilters(63, { versionProd: 'R06 - Pilot' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
  });

  test('filtre versionTest — exclut les issues sans la bonne version de test', async () => {
    const issues = [makeIssue(20), makeIssue(21)];
    gitlab._getPaginated.mockResolvedValue(issues);
    gitlab.executeGraphQL.mockResolvedValue(
      makeGraphQLData(issues, {
        20: { versionTest: 'Sprint-A' },
        21: { versionTest: null },
      })
    );

    const result = await gitlab.getIssuesByFilters(63, { versionTest: 'Sprint-A' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(20);
  });

  test('3 filtres cumulés en AND — garde seulement les issues qui matchent tout', async () => {
    const issues = [makeIssue(30), makeIssue(31), makeIssue(32)];
    gitlab._getPaginated.mockResolvedValue(issues);
    const STATUS = 'gid://gitlab/WorkItems::Statuses::Custom::Status/15';
    gitlab.executeGraphQL.mockResolvedValue(
      makeGraphQLData(issues, {
        30: { statusGid: STATUS, versionProd: 'R06 - Pilot', versionTest: 'Sprint-A' },
        31: { statusGid: STATUS, versionProd: 'R06 - Pilot', versionTest: null },
        32: { statusGid: STATUS, versionProd: 'R07 - Prod', versionTest: 'Sprint-A' },
      })
    );

    const result = await gitlab.getIssuesByFilters(63, {
      statusGid: STATUS,
      versionProd: 'R06 - Pilot',
      versionTest: 'Sprint-A',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(30);
  });

  test("aucune issue REST — pas d'appel GraphQL", async () => {
    gitlab._getPaginated.mockResolvedValue([]);

    const result = await gitlab.getIssuesByFilters(63, { statusGid: 'anything' });

    expect(gitlab.executeGraphQL).not.toHaveBeenCalled();
    expect(result).toHaveLength(0);
  });
});
