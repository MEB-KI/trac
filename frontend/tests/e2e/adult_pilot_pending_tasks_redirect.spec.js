const { test, expect } = require('@playwright/test');

const STUDY_NAME = 'adult_pilot_de';
const PARTICIPANT_ID = 'bernd';

const ADMIN_BASE_URL =
  process.env.PLAYWRIGHT_ADMIN_BASE_URL || 'http://127.0.0.1:3000/tud_backend';
const API_BASE_URL =
  process.env.PLAYWRIGHT_API_BASE_URL || `${ADMIN_BASE_URL}/api`;
const ADMIN_USER =
  process.env.PLAYWRIGHT_ADMIN_USER || 'timeusediary_api_admin';
const ADMIN_PASS =
  process.env.PLAYWRIGHT_ADMIN_PASS || 'timeusediary_api_admin_password';

function getBasicAuthHeader() {
  const auth = Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
  return { Authorization: `Basic ${auth}` };
}

function pickSubmissionTemplate(activitiesConfig) {
  const timelineConfig = activitiesConfig?.timeline || {};

  for (const [timelineKey, timelineValue] of Object.entries(timelineConfig)) {
    const mode = timelineValue?.mode || 'single-choice';
    const categories = Array.isArray(timelineValue?.categories)
      ? timelineValue.categories
      : [];

    for (const category of categories) {
      const categoryName = category?.name;
      const activities = Array.isArray(category?.activities)
        ? category.activities
        : [];

      for (const activity of activities) {
        const activityName = activity?.name;
        const activityCode = activity?.code;
        if (!activityName) {
          continue;
        }
        if (
          (mode === 'single-choice' || mode === 'multiple-choice') &&
          typeof activityCode !== 'number'
        ) {
          continue;
        }

        return {
          timelineKey,
          mode,
          categoryName,
          activityName,
          activityCode,
        };
      }
    }
  }

  throw new Error('Could not determine a valid activity template from activities-config.');
}

test('adult_pilot_de: bernd with pending external tasks lands on tasks page after completion', async ({
  page,
  request,
}) => {
  test.skip(
    !ADMIN_USER || !ADMIN_PASS,
    'Set PLAYWRIGHT_ADMIN_USER and PLAYWRIGHT_ADMIN_PASS to run this e2e test.'
  );

  const adminHeaders = getBasicAuthHeader();

  // Idempotency reset: remove prior participant data in this study while keeping assignment.
  const resetResponse = await request.delete(
    `${API_BASE_URL}/admin/studies/${STUDY_NAME}/participants/${PARTICIPANT_ID}/data`,
    { headers: adminHeaders }
  );
  if (resetResponse.status() === 401 || resetResponse.status() === 403) {
    test.skip(
      true,
      'Admin credentials were rejected. Set PLAYWRIGHT_ADMIN_USER and PLAYWRIGHT_ADMIN_PASS correctly.'
    );
  }
  expect(
    resetResponse.ok(),
    `reset endpoint failed (${resetResponse.status()}): ${await resetResponse.text()}`
  ).toBeTruthy();

  const reseedExternalTasksResponse = await request.post(
    `${API_BASE_URL}/admin/studies/${STUDY_NAME}/participants/${PARTICIPANT_ID}/external-tasks/reseed`,
    { headers: adminHeaders }
  );
  if (reseedExternalTasksResponse.status() === 404) {
    test.skip(
      true,
      'Backend does not expose external-task reseed endpoint yet. Restart backend on the current code revision.'
    );
  }
  expect(
    reseedExternalTasksResponse.ok(),
    `reseed endpoint failed (${reseedExternalTasksResponse.status()}): ${await reseedExternalTasksResponse.text()}`
  ).toBeTruthy();

  // Ensure consent/instructions are marked complete so this test can focus on diary completion + redirect.
  const consentResponse = await request.post(
    `${API_BASE_URL}/studies/${STUDY_NAME}/participants/${PARTICIPANT_ID}/consent`,
    { data: { consent_given: true } }
  );
  expect(consentResponse.ok()).toBeTruthy();

  const instructionsResponse = await request.post(
    `${API_BASE_URL}/studies/${STUDY_NAME}/participants/${PARTICIPANT_ID}/instructions/complete`,
    { data: { completed: true } }
  );
  expect(instructionsResponse.ok()).toBeTruthy();

  const studyConfigResponse = await request.get(
    `${API_BASE_URL}/studies/${STUDY_NAME}/study-config?participant_id=${PARTICIPANT_ID}&lang=de`
  );
  expect(studyConfigResponse.ok()).toBeTruthy();
  const studyConfig = await studyConfigResponse.json();
  expect(Array.isArray(studyConfig.day_labels)).toBeTruthy();
  expect(studyConfig.day_labels.length).toBeGreaterThan(0);

  const activitiesConfigResponse = await request.get(
    `${API_BASE_URL}/studies/${STUDY_NAME}/activities-config?lang=de&participant_id=${PARTICIPANT_ID}`
  );
  expect(activitiesConfigResponse.ok()).toBeTruthy();
  const activitiesConfig = await activitiesConfigResponse.json();
  const template = pickSubmissionTemplate(activitiesConfig);

  for (const dayLabel of studyConfig.day_labels) {
    const payload = {
      timeline_key: template.timelineKey,
      activity: template.activityName,
      category: template.categoryName,
      start_minutes: 600,
      end_minutes: 660,
      mode: template.mode,
    };

    if (template.mode === 'single-choice') {
      payload.code = template.activityCode;
    } else if (template.mode === 'multiple-choice') {
      payload.codes = [template.activityCode];
    }

    const submitResponse = await request.post(
      `${API_BASE_URL}/studies/${STUDY_NAME}/participants/${PARTICIPANT_ID}/day_labels/${dayLabel.name}/activities`,
      { data: { activities: [payload] } }
    );
    expect(submitResponse.ok()).toBeTruthy();
  }

  await page.goto(`index.html?study_name=${STUDY_NAME}&pid=${PARTICIPANT_ID}&lang=de`, {
    waitUntil: 'domcontentloaded',
  });

  await expect(page).toHaveURL(/pages\/tasks\.html/);
  await expect(page.locator('#tasks-list .task-item')).toHaveCount(2);
});
