const { test, expect } = require('@playwright/test');

test('completed participant visiting invitation link is redirected straight to thank-you page', async ({
  page,
}) => {
  await page.route('**/api/studies/completed/study-config**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        study_name: 'Completed Study',
        study_name_short: 'completed',
        description: 'Mocked completion redirect study',
        allow_unlisted_participants: false,
        require_consent: false,
        data_collection_start: '2024-01-01T00:00:00Z',
        data_collection_end: '2028-12-31T23:59:59Z',
        default_language: 'en',
        activities_json_url: '/unused.json',
        supported_languages: ['en'],
        selected_language: 'en',
        study_text_end_completed: 'You are done.',
        study_text_end_skipped: 'Skipped.',
        study_text_end_noconsent: 'No consent.',
        study_text_consent: null,
        consent_given: null,
        consent_decided_at: null,
        instructions_completed: true,
        instructions_completed_at: '2026-05-26T10:00:00Z',
        participant_has_completed_study: true,
        external_tasks: [],
        all_external_tasks_confirmed: false,
        timelines: [
          {
            name: 'primary',
            display_name: 'Primary',
            description: '',
            mode: 'single-choice',
            min_coverage: 0,
          },
        ],
        day_labels: [
          {
            name: 'monday',
            display_order: 0,
            display_name: 'Monday',
          },
        ],
        study_days_count: 1,
      }),
    });
  });

  await page.goto('index.html?study_name=completed&pid=p1&lang=en', {
    waitUntil: 'domcontentloaded',
  });

  await expect(page).toHaveURL(/pages\/thank-you\.html/);
  const completionStatus = new URL(page.url()).searchParams.get(
    'completion_status'
  );
  await expect(completionStatus).toBe('completed');
});
